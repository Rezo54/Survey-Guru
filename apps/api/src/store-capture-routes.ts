import type { FastifyInstance } from 'fastify';
import { createHash } from 'node:crypto';
import { verifyRequestIdentity } from './auth.js';
import { AuthorisationError, requireAssignmentScope, requirePermission, requireProjectScope, resolveAuthority } from './authority.js';
import { getFirebaseAdminServices } from './firebase-admin.js';
import { createStoreReportXlsx } from './store-report-xlsx.js';
import {
  evaluateAutomatedStoreQa,
  evaluateStoreCapturePreflight,
  findStoreIdentityCandidates,
  resolveStoreQaDecision,
  validateStoreCaptureSubmission,
  type StoreCaptureDraft,
  type StoreCaptureStatus,
  type StoreLocation,
  type StorePhotoEvidence,
  type StoreIdentity,
  type StoreQaDecision,
} from './store-capture.js';

type DraftBody = {
  observedName?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  accuracyMetres?: unknown;
  selectedExistingStoreId?: unknown;
  confirmedNewStore?: unknown;
  answers?: unknown;
  photos?: unknown;
};

type QaDecisionBody = { decision?: unknown; reason?: unknown };
type PreflightBody = Pick<DraftBody, 'observedName' | 'latitude' | 'longitude' | 'accuracyMetres' | 'selectedExistingStoreId' | 'confirmedNewStore'>;

const qaDecisions: readonly StoreQaDecision[] = ['VERIFY', 'VERIFY_AND_READY', 'RETURN_FOR_CORRECTION', 'REJECT', 'MARK_READY_FOR_EXPORT'];

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

function parseProjectBoundary(value: unknown): readonly StoreLocation[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const point = item as Record<string, unknown>;
    return finiteNumber(point.latitude) && finiteNumber(point.longitude)
      ? [{ latitude: point.latitude, longitude: point.longitude }]
      : [];
  });
}

function resolveQaPolicy(value: unknown) {
  const configured = value && typeof value === 'object' ? value as Record<string, unknown> : undefined;
  return {
    autoVerifyEnabled: configured?.autoVerifyEnabled !== false,
    manualApprovalBeforeExport: configured?.manualApprovalBeforeExport === true,
    maximumGpsAccuracyMetres: finiteNumber(configured?.maximumGpsAccuracyMetres) ? configured.maximumGpsAccuracyMetres : 30,
    minimumPhotoCount: finiteNumber(configured?.minimumPhotoCount) ? Math.max(1, Math.floor(configured.minimumPhotoCount)) : 1,
  };
}

async function loadStoreIdentities(firestore: ReturnType<typeof getFirebaseAdminServices>['firestore'], workspaceId: string): Promise<readonly StoreIdentity[]> {
  const snapshot = await firestore.collection('stores').where('workspaceId', '==', workspaceId).limit(1000).get();
  return snapshot.docs.map((document) => ({
    id: document.id,
    workspaceId: String(document.get('workspaceId') ?? ''),
    canonicalName: String(document.get('canonicalName') ?? ''),
    aliases: Array.isArray(document.get('aliases')) ? document.get('aliases') as string[] : [],
    location: document.get('location') as StoreLocation,
    dataRights: document.get('dataRights') === 'TASKRAFT_LICENSED_LEGACY' ? 'TASKRAFT_LICENSED_LEGACY' : 'TES_NEW_CAPTURE',
    ...(typeof document.get('sourceSnapshotId') === 'string' ? { sourceSnapshotId: document.get('sourceSnapshotId') as string } : {}),
    ...(typeof document.get('licenceScheduleId') === 'string' ? { licenceScheduleId: document.get('licenceScheduleId') as string } : {}),
  } satisfies StoreIdentity));
}

async function runStoreCapturePreflight(input: Readonly<{
  firestore: ReturnType<typeof getFirebaseAdminServices>['firestore'];
  workspaceId: string;
  projectId: string;
  observedName: string;
  location: StoreLocation;
  selectedExistingStoreId?: string;
  confirmedNewStore?: boolean;
}>) {
  const project = await input.firestore.collection('projects').doc(input.projectId).get();
  if (!project.exists || project.get('workspaceId') !== input.workspaceId) throw new AuthorisationError('Project is outside the authorised scope.');
  const policy = resolveQaPolicy(project.get('storeQaPolicy'));
  const stores = await loadStoreIdentities(input.firestore, input.workspaceId);
  const identityCandidates = findStoreIdentityCandidates({
    workspaceId: input.workspaceId,
    observedName: input.observedName,
    location: input.location,
    stores,
  });
  const assessment = evaluateStoreCapturePreflight({
    location: input.location,
    projectBoundary: parseProjectBoundary(project.get('boundary')),
    maximumGpsAccuracyMetres: policy.maximumGpsAccuracyMetres,
    identityCandidates,
    ...(input.selectedExistingStoreId ? { selectedExistingStoreId: input.selectedExistingStoreId } : {}),
    ...(input.confirmedNewStore ? { confirmedNewStore: true } : {}),
  });
  return { assessment, policy, project, stores };
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

async function requireQaCapture(request: Parameters<typeof verifyRequestIdentity>[0], captureId: string) {
  const identity = await verifyRequestIdentity(request);
  const authority = await resolveAuthority(identity);
  requirePermission(authority, 'qa.review');
  const { firestore, storage } = getFirebaseAdminServices();
  const capture = await firestore.collection('storeCaptures').doc(captureId).get();
  const projectId = capture.get('projectId');
  if (!capture.exists || capture.get('workspaceId') !== authority.workspaceId || typeof projectId !== 'string') {
    throw new AuthorisationError('Store capture is outside the authorised QA scope.');
  }
  requireProjectScope(authority, projectId);
  if (capture.get('capturerUserId') === identity.uid && !authority.permissions.has('platform.admin')) {
    throw new AuthorisationError('A capturer cannot review their own store capture.');
  }
  return { identity, authority, firestore, storage, capture, projectId };
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
  app.get<{ Params: { projectId: string }; Querystring: { status?: string; capturer?: string } }>('/api/v1/projects/:projectId/store-captures/export.xlsx', async (request, reply) => {
    const identity = await verifyRequestIdentity(request);
    const authority = await resolveAuthority(identity);
    requirePermission(authority, 'export.data');
    requireProjectScope(authority, request.params.projectId);
    const { firestore } = getFirebaseAdminServices();
    const snapshot = await firestore.collection('storeCaptures').where('projectId', '==', request.params.projectId).limit(5000).get();
    const requestedStatuses = new Set(String(request.query.status ?? '').split(',').map((value) => value.trim().toUpperCase()).filter(Boolean));
    const requestedCapturer = String(request.query.capturer ?? '').trim();
    const documents = snapshot.docs.filter((document) => document.get('workspaceId') === authority.workspaceId
      && (requestedStatuses.size === 0 || requestedStatuses.has(String(document.get('status'))))
      && (!requestedCapturer || document.get('capturerUserId') === requestedCapturer));
    const capturerIds = Array.from(new Set(documents.map((document) => document.get('capturerUserId')).filter((value): value is string => typeof value === 'string')));
    const capturerEntries = await Promise.all(capturerIds.map(async (userId) => {
      const user = await firestore.collection('users').doc(userId).get();
      return [userId, user.get('displayName') ?? user.get('email') ?? userId] as const;
    }));
    const capturers = new Map(capturerEntries);
    const rows = documents.map((document) => {
      const answers = document.get('answers');
      const answerRecord = answers && typeof answers === 'object' && !Array.isArray(answers) ? answers as Record<string, unknown> : {};
      const location = document.get('location') as Record<string, unknown> | undefined;
      const flattenedAnswers = Object.fromEntries(Object.entries(answerRecord).map(([key, value]) => [key, Array.isArray(value) || (value && typeof value === 'object') ? JSON.stringify(value) : value]));
      return {
        captureId: document.id,
        storeId: document.get('resolvedStoreId') ?? '',
        storeName: document.get('observedName') ?? '',
        status: document.get('status') ?? '',
        capturer: capturers.get(String(document.get('capturerUserId'))) ?? document.get('capturerUserId') ?? '',
        capturerUserId: document.get('capturerUserId') ?? '',
        capturedAt: document.get('submittedAt') ?? document.get('updatedAt') ?? '',
        latitude: location?.latitude ?? '',
        longitude: location?.longitude ?? '',
        accuracyMetres: location?.accuracyMetres ?? '',
        photoCount: Array.isArray(document.get('photos')) ? document.get('photos').length : 0,
        qaReason: document.get('correctionReason') ?? document.get('rejectionReason') ?? '',
        exportState: document.get('exportJobId') ? 'QUEUED' : 'NOT_QUEUED',
        ...flattenedAnswers,
      };
    });
    const workbook = createStoreReportXlsx(rows);
    const safeProject = request.params.projectId.replace(/[^A-Za-z0-9_-]/g, '_');
    return reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', `attachment; filename="${safeProject}-store-captures.xlsx"`)
      .header('Cache-Control', 'private, no-store').send(workbook);
  });

  app.get<{ Params: { projectId: string } }>('/api/v1/projects/:projectId/notifications', async (request) => {
    const identity = await verifyRequestIdentity(request);
    const authority = await resolveAuthority(identity);
    requirePermission(authority, 'project.read');
    requireProjectScope(authority, request.params.projectId);
    const { firestore } = getFirebaseAdminServices();
    const snapshot = await firestore.collection('projectNotifications').where('projectId', '==', request.params.projectId).limit(100).get();
    const notifications = snapshot.docs
      .filter((document) => document.get('workspaceId') === authority.workspaceId)
      .map((document) => ({ id: document.id, ...(document.data() as Record<string, unknown>) }) as { id: string; createdAt?: unknown; [key: string]: unknown })
      .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
    return { notifications, delivery: { channel: 'IN_APP', externalChannels: 'NOT_CONFIGURED' } };
  });

  app.get<{ Params: { projectId: string; captureId: string; photoIndex: string } }>('/api/v1/projects/:projectId/store-captures/:captureId/photos/:photoIndex', async (request, reply) => {
    const identity = await verifyRequestIdentity(request);
    const authority = await resolveAuthority(identity);
    requirePermission(authority, 'project.read');
    requireProjectScope(authority, request.params.projectId);
    const { firestore, storage } = getFirebaseAdminServices();
    const capture = await firestore.collection('storeCaptures').doc(request.params.captureId).get();
    if (!capture.exists || capture.get('workspaceId') !== authority.workspaceId || capture.get('projectId') !== request.params.projectId || !['READY_FOR_EXPORT', 'SYNCED'].includes(String(capture.get('status')))) throw new AuthorisationError('Captured store evidence is outside the authorised project scope.');
    const photoIndex = Number(request.params.photoIndex);
    const photos = capture.get('photos') as readonly StorePhotoEvidence[] | undefined;
    const photo = Number.isInteger(photoIndex) && photoIndex >= 0 ? photos?.[photoIndex] : undefined;
    if (!photo) throw new StoreCaptureRequestError('Store photo evidence was not found.');
    const expectedPrefix = `workspaces/${authority.workspaceId}/projects/${request.params.projectId}/captures/${capture.id}/`;
    if (!photo.storageObjectPath.startsWith(expectedPrefix)) throw new AuthorisationError('Store photo evidence is outside the authorised project scope.');
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
    if (!bucketName) throw new StoreCaptureRequestError('FIREBASE_STORAGE_BUCKET is not configured.');
    const file = storage.bucket(bucketName).file(photo.storageObjectPath);
    const [metadata] = await file.getMetadata();
    const contentType = String(metadata.contentType ?? '');
    const size = Number(metadata.size);
    if (!contentType.startsWith('image/') || !Number.isFinite(size) || size <= 0 || size > 10 * 1024 * 1024) throw new StoreCaptureRequestError('Store photo evidence is not a valid image.');
    const [contents] = await file.download();
    if (createHash('sha256').update(contents).digest('hex') !== photo.sha256.toLowerCase()) throw new StoreCaptureRequestError('Store photo evidence failed its integrity check.');
    return reply.header('Content-Type', contentType).header('Cache-Control', 'private, no-store').send(contents);
  });

  app.get<{ Params: { projectId: string } }>('/api/v1/projects/:projectId/store-captures/qa', async (request) => {
    const identity = await verifyRequestIdentity(request);
    const authority = await resolveAuthority(identity);
    requirePermission(authority, 'qa.review');
    requireProjectScope(authority, request.params.projectId);
    const { firestore } = getFirebaseAdminServices();
    const snapshot = await firestore.collection('storeCaptures').where('projectId', '==', request.params.projectId).limit(100).get();
    const reviewable = new Set<StoreCaptureStatus>(['SUBMITTED']);
    const storeCaptures = snapshot.docs
      .filter((document) => document.get('workspaceId') === authority.workspaceId && reviewable.has(document.get('status') as StoreCaptureStatus))
      .map((document) => ({
        id: document.id,
        observedName: document.get('observedName'),
        status: document.get('status'),
        location: document.get('location'),
        answers: document.get('answers'),
        photoCount: Array.isArray(document.get('photos')) ? document.get('photos').length : 0,
        automatedQa: document.get('automatedQa'),
        capturerUserId: document.get('capturerUserId'),
        submittedAt: document.get('submittedAt'),
        updatedAt: document.get('updatedAt'),
      }))
      .sort((left, right) => String(left.submittedAt ?? left.updatedAt).localeCompare(String(right.submittedAt ?? right.updatedAt)));
    return { storeCaptures, authority: { permission: 'qa.review', workspaceId: authority.workspaceId, projectScoped: true } };
  });

  app.get<{ Params: { captureId: string; photoIndex: string } }>('/api/v1/store-captures/:captureId/qa-photos/:photoIndex', async (request, reply) => {
    const { storage, capture, authority, projectId } = await requireQaCapture(request, request.params.captureId);
    const photoIndex = Number(request.params.photoIndex);
    const photos = capture.get('photos') as readonly StorePhotoEvidence[] | undefined;
    const photo = Number.isInteger(photoIndex) && photoIndex >= 0 ? photos?.[photoIndex] : undefined;
    if (!photo) throw new StoreCaptureRequestError('Store photo evidence was not found.');
    const expectedPrefix = `workspaces/${authority.workspaceId}/projects/${projectId}/captures/${capture.id}/`;
    if (!photo.storageObjectPath.startsWith(expectedPrefix)) throw new AuthorisationError('Store photo evidence is outside the authorised QA scope.');
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
    if (!bucketName) throw new StoreCaptureRequestError('FIREBASE_STORAGE_BUCKET is not configured.');
    const file = storage.bucket(bucketName).file(photo.storageObjectPath);
    const [metadata] = await file.getMetadata();
    const contentType = String(metadata.contentType ?? '');
    const size = Number(metadata.size);
    if (!contentType.startsWith('image/') || !Number.isFinite(size) || size <= 0 || size > 10 * 1024 * 1024) {
      throw new StoreCaptureRequestError('Store photo evidence is not a valid reviewable image.');
    }
    const [contents] = await file.download();
    const actualSha256 = createHash('sha256').update(contents).digest('hex');
    if (actualSha256 !== photo.sha256.toLowerCase()) throw new StoreCaptureRequestError('Store photo evidence failed its integrity check.');
    return reply.header('Content-Type', contentType).header('Cache-Control', 'private, no-store').send(contents);
  });

  app.post<{ Params: { captureId: string }; Body: QaDecisionBody }>('/api/v1/store-captures/:captureId/qa-decision', async (request) => {
    const { identity, authority, firestore, capture } = await requireQaCapture(request, request.params.captureId);
    const decision = typeof request.body?.decision === 'string' && qaDecisions.includes(request.body.decision as StoreQaDecision)
      ? request.body.decision as StoreQaDecision
      : null;
    if (!decision) throw new StoreCaptureRequestError('A valid QA decision is required.');
    const reason = typeof request.body?.reason === 'string' ? request.body.reason.trim() : '';
    const eventRef = firestore.collection('storeCaptureQaEvents').doc();
    const newStoreRef = firestore.collection('stores').doc();
    const exportJobRef = firestore.collection('storeExportJobs').doc();
    const capturerNotificationRef = firestore.collection('projectNotifications').doc();
    const decidedAt = new Date().toISOString();
    await firestore.runTransaction(async (transaction) => {
      const current = await transaction.get(capture.ref);
      if (!current.exists || current.get('workspaceId') !== authority.workspaceId) throw new AuthorisationError('Store capture is outside the authorised QA scope.');
      const from = current.get('status') as StoreCaptureStatus;
      let resolution;
      try { resolution = resolveStoreQaDecision(from, decision); }
      catch (error) { throw new StoreCaptureRequestError(error instanceof Error ? error.message : 'The QA decision is not permitted.'); }
      if (resolution.requiresReason && reason.length < 5) throw new StoreCaptureRequestError('A clear QA reason of at least 5 characters is required.');
      const update: Record<string, unknown> = {
        status: resolution.finalStatus,
        updatedAt: decidedAt,
        lastQaDecision: decision,
        lastQaReason: reason || null,
        lastReviewedAt: decidedAt,
        lastReviewedBy: identity.uid,
      };
      if (resolution.transitions.some((transition) => transition.to === 'VERIFIED')) Object.assign(update, { verifiedAt: decidedAt, verifiedBy: identity.uid });
      if (resolution.finalStatus === 'READY_FOR_EXPORT') Object.assign(update, { readyForExportAt: decidedAt, readyForExportBy: identity.uid });
      if (resolution.finalStatus === 'NEEDS_REVIEW') Object.assign(update, { correctionReason: reason });
      if (resolution.finalStatus === 'REJECTED') Object.assign(update, { rejectedAt: decidedAt, rejectedBy: identity.uid, rejectionReason: reason });
      if (resolution.finalStatus === 'READY_FOR_EXPORT') {
        const selectedExistingStoreId = current.get('selectedExistingStoreId');
        let resolvedStoreId: string;
        if (typeof selectedExistingStoreId === 'string' && selectedExistingStoreId) {
          const existingStoreRef = firestore.collection('stores').doc(selectedExistingStoreId);
          const existingStore = await transaction.get(existingStoreRef);
          if (!existingStore.exists || existingStore.get('workspaceId') !== authority.workspaceId) throw new AuthorisationError('The selected store identity is outside the authorised QA scope.');
          resolvedStoreId = existingStore.id;
        } else {
          resolvedStoreId = newStoreRef.id;
          transaction.create(newStoreRef, {
            workspaceId: authority.workspaceId,
            canonicalName: current.get('observedName'),
            aliases: [],
            location: current.get('location'),
            dataRights: 'TES_NEW_CAPTURE',
            status: 'active',
            createdFromCaptureId: current.id,
            verifiedAt: decidedAt,
            verifiedBy: identity.uid,
            environment: process.env.SURVEY_GURU_ENV ?? 'local',
          });
        }
        Object.assign(update, { resolvedStoreId, exportJobId: exportJobRef.id });
        transaction.create(exportJobRef, {
          workspaceId: authority.workspaceId,
          projectId: current.get('projectId'),
          storeCaptureId: current.id,
          storeId: resolvedStoreId,
          state: 'PENDING',
          createdAt: decidedAt,
          createdBy: identity.uid,
          environment: process.env.SURVEY_GURU_ENV ?? 'local',
        });
      }
      transaction.update(current.ref, update);
      transaction.create(eventRef, {
        workspaceId: authority.workspaceId,
        projectId: current.get('projectId'),
        storeCaptureId: current.id,
        reviewerUserId: identity.uid,
        decision,
        reason: reason || null,
        fromStatus: from,
        toStatus: resolution.finalStatus,
        transitions: resolution.transitions,
        decidedAt,
        environment: process.env.SURVEY_GURU_ENV ?? 'local',
      });
      if (resolution.finalStatus === 'NEEDS_REVIEW' || resolution.finalStatus === 'REJECTED') {
        transaction.create(capturerNotificationRef, {
          workspaceId: authority.workspaceId,
          projectId: current.get('projectId'),
          storeCaptureId: current.id,
          type: resolution.finalStatus === 'NEEDS_REVIEW' ? 'STORE_REDO_REQUIRED' : 'STORE_REJECTED',
          severity: 'ACTION_REQUIRED',
          title: resolution.finalStatus === 'NEEDS_REVIEW' ? `${current.get('observedName')} must be redone` : `${current.get('observedName')} was rejected`,
          message: reason,
          recipientUserId: current.get('capturerUserId'),
          actorUserId: identity.uid,
          audiencePermission: 'field.capture',
          channel: 'IN_APP',
          deliveryState: 'AVAILABLE',
          createdAt: decidedAt,
          environment: process.env.SURVEY_GURU_ENV ?? 'local',
        });
      }
    });
    const updated = await capture.ref.get();
    return { storeCapture: { id: updated.id, ...updated.data() }, qaEventId: eventRef.id, authority: { permission: 'qa.review', workspaceId: authority.workspaceId, projectScoped: true } };
  });

  app.post<{ Params: { assignmentId: string }; Body: PreflightBody }>('/api/v1/assignments/:assignmentId/store-captures/preflight', async (request) => {
    const { authority, firestore, projectId } = await requireAuthorisedAssignment(request, request.params.assignmentId);
    const observedName = typeof request.body?.observedName === 'string' ? request.body.observedName.trim() : '';
    if (!observedName) throw new StoreCaptureRequestError('Store name is required before checking the location.');
    const location = parseLocation(request.body ?? {});
    const selectedExistingStoreId = typeof request.body?.selectedExistingStoreId === 'string' && request.body.selectedExistingStoreId.trim()
      ? request.body.selectedExistingStoreId.trim()
      : undefined;
    const confirmedNewStore = request.body?.confirmedNewStore === true;
    const { assessment, policy } = await runStoreCapturePreflight({
      firestore,
      workspaceId: authority.workspaceId,
      projectId,
      observedName,
      location,
      ...(selectedExistingStoreId ? { selectedExistingStoreId } : {}),
      ...(confirmedNewStore ? { confirmedNewStore: true } : {}),
    });
    return {
      preflight: assessment,
      policy: { maximumGpsAccuracyMetres: policy.maximumGpsAccuracyMetres },
      authority: { permission: 'field.capture', assignmentScoped: true, projectScoped: true, identityScoped: true },
    };
  });

  app.post<{ Params: { assignmentId: string }; Body: DraftBody }>('/api/v1/assignments/:assignmentId/store-captures', async (request, reply) => {
    const { identity, authority, firestore, projectId } = await requireAuthorisedAssignment(request, request.params.assignmentId);
    const observedName = typeof request.body?.observedName === 'string' ? request.body.observedName.trim() : '';
    if (!observedName) throw new StoreCaptureRequestError('Store name is required.');
    const location = parseLocation(request.body ?? {});
    const answers = parseAnswers(request.body?.answers);
    const photos = parsePhotos(request.body?.photos);
    const selectedExistingStoreId = typeof request.body?.selectedExistingStoreId === 'string' && request.body.selectedExistingStoreId.trim() ? request.body.selectedExistingStoreId.trim() : undefined;
    const confirmedNewStore = request.body?.confirmedNewStore === true;
    const { assessment } = await runStoreCapturePreflight({
      firestore,
      workspaceId: authority.workspaceId,
      projectId,
      observedName,
      location,
      ...(selectedExistingStoreId ? { selectedExistingStoreId } : {}),
      ...(confirmedNewStore ? { confirmedNewStore: true } : {}),
    });
    if (!assessment.allowed) throw new StoreCaptureRequestError(assessment.reasons.map((reason) => reason.message).join(' '));
    const captureRef = firestore.collection('storeCaptures').doc();
    const now = new Date().toISOString();
    const capture = {
      workspaceId: authority.workspaceId, projectId, assignmentId: request.params.assignmentId, capturerUserId: identity.uid,
      observedName, location, ...(selectedExistingStoreId ? { selectedExistingStoreId } : {}), ...(confirmedNewStore ? { confirmedNewStore: true } : {}), answers, photos,
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
    const confirmedNewStore = request.body?.confirmedNewStore === true;
    if (selectedExistingStoreId && confirmedNewStore) throw new StoreCaptureRequestError('Choose either an existing store or a separate new store, not both.');
    if (selectedExistingStoreId) {
      const existing = await firestore.collection('stores').doc(selectedExistingStoreId).get();
      if (!existing.exists || existing.get('workspaceId') !== authority.workspaceId) throw new StoreCaptureRequestError('The selected existing store is not available in this workspace.');
    }
    const expectedPrefix = `workspaces/${authority.workspaceId}/projects/${projectId}/captures/${capture.id}/`;
    if (photos.some((photo) => !photo.storageObjectPath.startsWith(expectedPrefix))) throw new StoreCaptureRequestError('Photo evidence is outside the authorised capture path.');
    const updatedAt = new Date().toISOString();
    await capture.ref.update({ observedName, location, answers, photos, selectedExistingStoreId: selectedExistingStoreId ?? null, confirmedNewStore, updatedAt });
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
      ...(data.confirmedNewStore === true ? { confirmedNewStore: true } : {}),
      answers: (data.answers ?? {}) as Readonly<Record<string, unknown>>,
      photos: (data.photos ?? []) as readonly StorePhotoEvidence[],
      status: data.status as StoreCaptureDraft['status'],
    };
    const issues = [...validateStoreCaptureSubmission(draft, requiredQuestionIds)];
    const expectedPrefix = `workspaces/${authority.workspaceId}/projects/${projectId}/captures/${capture.id}/`;
    if (draft.photos.some((photo) => !photo.storageObjectPath.startsWith(expectedPrefix))) issues.push('Photo evidence is outside the authorised capture path.');
    const photoIssues = await verifyStoredPhotos(storage, draft.photos);
    issues.push(...photoIssues);
    if (issues.length > 0) throw new StoreCaptureRequestError(issues.join(' '));
    const submittedAt = new Date().toISOString();
    const stores = await loadStoreIdentities(firestore, authority.workspaceId);
    const identityCandidates = findStoreIdentityCandidates({ workspaceId: authority.workspaceId, observedName: draft.observedName, location: draft.location, stores });
    const policy = resolveQaPolicy(project.get('storeQaPolicy'));
    const automatedQa = evaluateAutomatedStoreQa({ draft, requiredQuestionIds, storedPhotoIntegrityVerified: photoIssues.length === 0, identityCandidates, policy });
    const update: Record<string, unknown> = {
      status: automatedQa.outcome === 'AUTO_VERIFIED' && !automatedQa.manualApprovalBeforeExport ? 'READY_FOR_EXPORT' : automatedQa.recommendedStatus,
      submittedAt,
      updatedAt: submittedAt,
      identityCandidates,
      automatedQa: { ...automatedQa, assessedAt: submittedAt, policyVersion: 'store-qa-dev-v1' },
    };
    if (automatedQa.recommendedStatus === 'VERIFIED') Object.assign(update, { verifiedAt: submittedAt, verifiedBy: 'AUTOMATED_QA' });
    if (automatedQa.outcome === 'AUTO_VERIFIED' && !automatedQa.manualApprovalBeforeExport) {
      const selectedExistingStoreId = draft.selectedExistingStoreId;
      const newStoreRef = firestore.collection('stores').doc();
      const exportJobRef = firestore.collection('storeExportJobs').doc();
      const notificationRef = firestore.collection('projectNotifications').doc();
      await firestore.runTransaction(async (transaction) => {
        const current = await transaction.get(capture.ref);
        if (!current.exists || (current.get('status') !== 'DRAFT' && current.get('status') !== 'NEEDS_REVIEW')) {
          throw new StoreCaptureRequestError('Only a draft or corrected capture can enter the integration queue.');
        }
        let resolvedStoreId: string;
        if (selectedExistingStoreId) {
          const existingStoreRef = firestore.collection('stores').doc(selectedExistingStoreId);
          const existingStore = await transaction.get(existingStoreRef);
          if (!existingStore.exists || existingStore.get('workspaceId') !== authority.workspaceId) throw new AuthorisationError('The selected store identity is outside the authorised scope.');
          resolvedStoreId = existingStore.id;
        } else {
          resolvedStoreId = newStoreRef.id;
          transaction.create(newStoreRef, {
            workspaceId: authority.workspaceId,
            canonicalName: draft.observedName,
            aliases: [],
            location: draft.location,
            dataRights: 'TES_NEW_CAPTURE',
            status: 'active',
            createdFromCaptureId: capture.id,
            verifiedAt: submittedAt,
            verifiedBy: 'AUTOMATED_QA',
            environment: process.env.SURVEY_GURU_ENV ?? 'local',
          });
        }
        Object.assign(update, {
          readyForExportAt: submittedAt,
          readyForExportBy: 'INTEGRATION_POLICY',
          resolvedStoreId,
          exportJobId: exportJobRef.id,
        });
        transaction.update(capture.ref, update);
        transaction.create(exportJobRef, {
          workspaceId: authority.workspaceId,
          projectId,
          storeCaptureId: capture.id,
          storeId: resolvedStoreId,
          destination: 'PREMIER',
          state: 'PENDING',
          createdAt: submittedAt,
          createdBy: 'INTEGRATION_POLICY',
          environment: process.env.SURVEY_GURU_ENV ?? 'local',
        });
        transaction.create(notificationRef, {
          workspaceId: authority.workspaceId, projectId, storeCaptureId: capture.id, type: 'STORE_CAPTURED', severity: 'INFO',
          title: `${draft.observedName} captured successfully`, message: `A clean store capture passed automated verification and entered the Premier export queue.`,
          actorUserId: draft.capturerUserId, audiencePermission: 'project.read', channel: 'IN_APP', deliveryState: 'AVAILABLE', createdAt: submittedAt,
          environment: process.env.SURVEY_GURU_ENV ?? 'local',
        });
      });
    } else {
      await capture.ref.update(update);
      await firestore.collection('projectNotifications').add({
        workspaceId: authority.workspaceId, projectId, storeCaptureId: capture.id, type: 'STORE_QA_REQUIRED', severity: 'ACTION_REQUIRED',
        title: `${draft.observedName} requires QA review`, message: automatedQa.checks.filter((check) => !check.passed).map((check) => check.message).join(' '),
        actorUserId: draft.capturerUserId, audiencePermission: 'qa.review', channel: 'IN_APP', deliveryState: 'AVAILABLE', createdAt: submittedAt,
        environment: process.env.SURVEY_GURU_ENV ?? 'local',
      });
    }
    const updated = await capture.ref.get();
    return { storeCapture: { id: updated.id, ...updated.data() }, authority: { permission: 'field.capture', workspaceId: authority.workspaceId, identityScoped: true } };
  });
}
