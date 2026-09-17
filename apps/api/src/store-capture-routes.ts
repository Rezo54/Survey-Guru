import type { FastifyInstance } from 'fastify';
import { createHash } from 'node:crypto';
import { verifyRequestIdentity } from './auth.js';
import { AuthorisationError, requireAssignmentScope, requirePermission, requireProjectScope, resolveAuthority } from './authority.js';
import { getFirebaseAdminServices } from './firebase-admin.js';
import { validateStoreCaptureSubmission, type StoreCaptureDraft, type StoreLocation, type StorePhotoEvidence } from './store-capture.js';

type DraftBody = {
  observedName?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  accuracyMetres?: unknown;
  selectedExistingStoreId?: unknown;
  answers?: unknown;
  photos?: unknown;
};

export class StoreCaptureRequestError extends Error {
  statusCode = 400;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseLocation(body: DraftBody): StoreLocation {
  if (!finiteNumber(body.latitude) || body.latitude < -90 || body.latitude > 90 || !finiteNumber(body.longitude) || body.longitude < -180 || body.longitude > 180) {
    throw new StoreCaptureRequestError('Valid store coordinates are required.');
  }
  if (body.accuracyMetres !== undefined && (!finiteNumber(body.accuracyMetres) || body.accuracyMetres < 0 || body.accuracyMetres > 500)) {
    throw new StoreCaptureRequestError('Store location accuracy is invalid.');
  }
  return { latitude: body.latitude, longitude: body.longitude, ...(body.accuracyMetres === undefined ? {} : { accuracyMetres: body.accuracyMetres }) };
}

function parseAnswers(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new StoreCaptureRequestError('Questionnaire answers are required.');
  return value as Readonly<Record<string, unknown>>;
}

function parsePhotos(value: unknown): readonly StorePhotoEvidence[] {
  if (!Array.isArray(value)) throw new StoreCaptureRequestError('Photo evidence must be an array.');
  return value.map((item) => {
    if (!item || typeof item !== 'object') throw new StoreCaptureRequestError('Photo evidence is invalid.');
    const photo = item as Record<string, unknown>;
    if (typeof photo.storageObjectPath !== 'string' || typeof photo.sha256 !== 'string' || typeof photo.capturedAt !== 'string' || !Number.isFinite(Date.parse(photo.capturedAt))) {
      throw new StoreCaptureRequestError('Photo evidence metadata is invalid.');
    }
    return { storageObjectPath: photo.storageObjectPath, sha256: photo.sha256, capturedAt: new Date(photo.capturedAt).toISOString() };
  });
}

async function requireAuthorisedAssignment(request: Parameters<typeof verifyRequestIdentity>[0], assignmentId: string) {
  const identity = await verifyRequestIdentity(request);
  const authority = await resolveAuthority(identity);
  requirePermission(authority, 'field.capture');
  requireAssignmentScope(authority, assignmentId);
  const { firestore } = getFirebaseAdminServices();
  const assignment = await firestore.collection('assignments').doc(assignmentId).get();
  const projectId = assignment.get('projectId');
  if (!assignment.exists || assignment.get('workspaceId') !== authority.workspaceId || assignment.get('assignedUserId') !== identity.uid || typeof projectId !== 'string') {
    throw new AuthorisationError('Assignment is outside the authorised scope.');
  }
  requireProjectScope(authority, projectId);
  return { identity, authority, firestore, assignment, projectId };
}

async function requireOwnedCapture(request: Parameters<typeof verifyRequestIdentity>[0], captureId: string) {
  const identity = await verifyRequestIdentity(request);
  const authority = await resolveAuthority(identity);
  requirePermission(authority, 'field.capture');
  const { firestore, storage } = getFirebaseAdminServices();
  const capture = await firestore.collection('storeCaptures').doc(captureId).get();
  if (!capture.exists || capture.get('workspaceId') !== authority.workspaceId || capture.get('capturerUserId') !== identity.uid) throw new AuthorisationError('Store capture is outside the authorised scope.');
  const assignmentId = capture.get('assignmentId');
  const projectId = capture.get('projectId');
  if (typeof assignmentId !== 'string' || typeof projectId !== 'string') throw new AuthorisationError('Store capture scope is invalid.');
  requireAssignmentScope(authority, assignmentId);
  requireProjectScope(authority, projectId);
  return { identity, authority, firestore, storage, capture, assignmentId, projectId };
}

async function verifyStoredPhotos(storage: ReturnType<typeof getFirebaseAdminServices>['storage'], photos: readonly StorePhotoEvidence[]): Promise<readonly string[]> {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
  if (!bucketName) return ['FIREBASE_STORAGE_BUCKET must be configured before photo evidence can be submitted.'];
  const bucket = storage.bucket(bucketName);
  const issues: string[] = [];
  for (const photo of photos) {
    try {
      const file = bucket.file(photo.storageObjectPath);
      const [metadata] = await file.getMetadata();
      if (!String(metadata.contentType ?? '').startsWith('image/')) issues.push('Store photo evidence must be an image.');
      const size = Number(metadata.size);
      if (!Number.isFinite(size) || size <= 0) issues.push('Store photo evidence is empty.');
      else if (size > 10 * 1024 * 1024) issues.push('Store photo evidence exceeds the 10 MB limit.');
      if (metadata.metadata?.sha256 !== photo.sha256) issues.push('Store photo evidence hash does not match the uploaded object.');
      else if (size > 0 && size <= 10 * 1024 * 1024) {
        const [contents] = await file.download();
        const actualSha256 = createHash('sha256').update(contents).digest('hex');
        if (actualSha256 !== photo.sha256.toLowerCase()) issues.push('Store photo evidence content failed its integrity check.');
      }
    } catch {
      issues.push('Store photo evidence could not be verified in authorised storage.');
    }
  }
  return issues;
}

export function registerStoreCaptureRoutes(app: FastifyInstance): void {
  app.post<{ Params: { assignmentId: string }; Body: DraftBody }>('/api/v1/assignments/:assignmentId/store-captures', async (request, reply) => {
    const { identity, authority, firestore, projectId } = await requireAuthorisedAssignment(request, request.params.assignmentId);
    const observedName = typeof request.body?.observedName === 'string' ? request.body.observedName.trim() : '';
    if (!observedName) throw new StoreCaptureRequestError('Store name is required.');
    const location = parseLocation(request.body ?? {});
    const answers = parseAnswers(request.body?.answers);
    const photos = parsePhotos(request.body?.photos);
    const selectedExistingStoreId = typeof request.body?.selectedExistingStoreId === 'string' && request.body.selectedExistingStoreId.trim() ? request.body.selectedExistingStoreId.trim() : undefined;
    if (selectedExistingStoreId) {
      const existing = await firestore.collection('stores').doc(selectedExistingStoreId).get();
      if (!existing.exists || existing.get('workspaceId') !== authority.workspaceId) throw new StoreCaptureRequestError('The selected existing store is not available in this workspace.');
    }
    const captureRef = firestore.collection('storeCaptures').doc();
    const now = new Date().toISOString();
    const capture = {
      workspaceId: authority.workspaceId, projectId, assignmentId: request.params.assignmentId, capturerUserId: identity.uid,
      observedName, location, ...(selectedExistingStoreId ? { selectedExistingStoreId } : {}), answers, photos,
      status: 'DRAFT' as const, dataRights: 'TES_NEW_CAPTURE' as const, createdAt: now, updatedAt: now,
      environment: process.env.SURVEY_GURU_ENV ?? 'local',
    };
    await captureRef.create(capture);
    return reply.code(201).send({ storeCapture: { id: captureRef.id, ...capture }, authority: { permission: 'field.capture', assignmentScoped: true, projectScoped: true, identityScoped: true } });
  });

  app.get<{ Params: { captureId: string } }>('/api/v1/store-captures/:captureId', async (request) => {
    const { authority, capture } = await requireOwnedCapture(request, request.params.captureId);
    return { storeCapture: { id: capture.id, ...capture.data() }, authority: { permission: 'field.capture', workspaceId: authority.workspaceId, identityScoped: true } };
  });

  app.patch<{ Params: { captureId: string }; Body: DraftBody }>('/api/v1/store-captures/:captureId', async (request) => {
    const { authority, firestore, capture, projectId } = await requireOwnedCapture(request, request.params.captureId);
    if (capture.get('status') !== 'DRAFT' && capture.get('status') !== 'NEEDS_REVIEW') throw new StoreCaptureRequestError('Only a draft or returned capture can be edited.');
    const observedName = typeof request.body?.observedName === 'string' ? request.body.observedName.trim() : '';
    if (!observedName) throw new StoreCaptureRequestError('Store name is required.');
    const location = parseLocation(request.body ?? {});
    const answers = parseAnswers(request.body?.answers);
    const photos = parsePhotos(request.body?.photos);
    const selectedExistingStoreId = typeof request.body?.selectedExistingStoreId === 'string' && request.body.selectedExistingStoreId.trim() ? request.body.selectedExistingStoreId.trim() : undefined;
    if (selectedExistingStoreId) {
      const existing = await firestore.collection('stores').doc(selectedExistingStoreId).get();
      if (!existing.exists || existing.get('workspaceId') !== authority.workspaceId) throw new StoreCaptureRequestError('The selected existing store is not available in this workspace.');
    }
    const expectedPrefix = `workspaces/${authority.workspaceId}/projects/${projectId}/captures/${capture.id}/`;
    if (photos.some((photo) => !photo.storageObjectPath.startsWith(expectedPrefix))) throw new StoreCaptureRequestError('Photo evidence is outside the authorised capture path.');
    const updatedAt = new Date().toISOString();
    await capture.ref.update({ observedName, location, answers, photos, selectedExistingStoreId: selectedExistingStoreId ?? null, updatedAt });
    const updated = await capture.ref.get();
    return { storeCapture: { id: updated.id, ...updated.data() }, authority: { permission: 'field.capture', workspaceId: authority.workspaceId, identityScoped: true } };
  });

  app.post<{ Params: { captureId: string } }>('/api/v1/store-captures/:captureId/submit', async (request) => {
    const { authority, firestore, storage, capture, assignmentId, projectId } = await requireOwnedCapture(request, request.params.captureId);
    const project = await firestore.collection('projects').doc(projectId).get();
    const configuredQuestions = project.get('storeCaptureRequiredQuestionIds');
    const requiredQuestionIds = Array.isArray(configuredQuestions) && configuredQuestions.every((value) => typeof value === 'string')
      ? configuredQuestions as string[]
      : ['ownerName', 'stockedBrands', 'pricing'];
    const data = capture.data();
    if (!data) throw new AuthorisationError('Store capture is outside the authorised scope.');
    const draft: StoreCaptureDraft = {
      id: capture.id, workspaceId: authority.workspaceId, projectId, assignmentId,
      capturerUserId: String(data.capturerUserId ?? ''), observedName: String(data.observedName ?? ''),
      location: data.location as StoreLocation,
      ...(typeof data.selectedExistingStoreId === 'string' ? { selectedExistingStoreId: data.selectedExistingStoreId } : {}),
      answers: (data.answers ?? {}) as Readonly<Record<string, unknown>>,
      photos: (data.photos ?? []) as readonly StorePhotoEvidence[],
      status: data.status as StoreCaptureDraft['status'],
    };
    const issues = [...validateStoreCaptureSubmission(draft, requiredQuestionIds)];
    const expectedPrefix = `workspaces/${authority.workspaceId}/projects/${projectId}/captures/${capture.id}/`;
    if (draft.photos.some((photo) => !photo.storageObjectPath.startsWith(expectedPrefix))) issues.push('Photo evidence is outside the authorised capture path.');
    issues.push(...await verifyStoredPhotos(storage, draft.photos));
    if (issues.length > 0) throw new StoreCaptureRequestError(issues.join(' '));
    const submittedAt = new Date().toISOString();
    await capture.ref.update({ status: 'SUBMITTED', submittedAt, updatedAt: submittedAt });
    const updated = await capture.ref.get();
    return { storeCapture: { id: updated.id, ...updated.data() }, authority: { permission: 'field.capture', workspaceId: authority.workspaceId, identityScoped: true } };
  });
}
