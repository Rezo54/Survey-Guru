import { registerBusinessRoutes } from './business-routes.js';
import { PhotoStorageError } from './photo-storage.js';
import { registerLinkedInRoutes } from './linkedin-routes.js';
import { LinkedInError } from './linkedin.js';
import { parseMovement, movementKey, movementFingerprint, validateMovement, type Point } from './movement-input.js';
import Fastify from 'fastify';
import { registerOperationsRoutes } from './operations-routes.js';
import { registerInsightRoutes } from './insight-routes.js';
import { AuthenticationError, verifyRequestIdentity } from './auth.js';
import { AuthorisationError, requireAssignmentScope, requirePermission, requireProjectScope, resolveAuthority } from './authority.js';
import { getFirebaseAdminServices, isFirebaseAdminConfigured } from './firebase-admin.js';
import { registerStreetCoverageRoutes } from './street-coverage-routes.js';
import { registerStoreCaptureRoutes, StoreCaptureRequestError } from './store-capture-routes.js';
import { registerProjectSetupRoutes, ProjectSetupRequestError } from './project-setup-routes.js';
import { reconcileAcceptedMovementPair, type AcceptedPairResult } from './movement-map-match.js';
import type { AcceptedMovementPoint } from './map-match-persistence.js';

const app = Fastify({ logger: true });
const allowedWebOrigin = process.env.SURVEY_GURU_WEB_ORIGIN ?? 'http://localhost:3000';

app.addHook('onRequest', async (request, reply) => {
  const origin = request.headers.origin;
  if (origin === allowedWebOrigin) { reply.header('Access-Control-Allow-Origin', allowedWebOrigin); reply.header('Vary', 'Origin'); reply.header('Access-Control-Allow-Headers', 'Authorization, Content-Type'); reply.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS'); }
  if (request.method === 'OPTIONS') { if (origin !== allowedWebOrigin) return reply.code(403).send({ error: 'origin_not_allowed', message: 'The request origin is not authorised for this API.' }); return reply.code(204).send(); }
});

app.setErrorHandler((error, _request, reply) => {
  if (error instanceof LinkedInError) return reply.code(error.statusCode).send({message:error.message});
  if (error instanceof PhotoStorageError) { app.log.error(error); return reply.code(error.statusCode).header('Cache-Control','no-store').send({error:error.code,message:error.message}); }
  if (error instanceof AuthenticationError) return reply.code(error.statusCode).send({ error: 'unauthenticated', message: error.message });
  if (error instanceof AuthorisationError) return reply.code(error.statusCode).send({ error: 'forbidden', message: error.message });
  if (error instanceof StoreCaptureRequestError) return reply.code(error.statusCode).send({ error: 'invalid_store_capture', message: error.message });
  if (error instanceof ProjectSetupRequestError) return reply.code(error.statusCode).send({ error: 'invalid_project_setup', message: error.message });
  app.log.error(error); return reply.code(500).send({ error: 'internal_error', message: 'The request could not be completed.' });
});

registerStreetCoverageRoutes(app);
registerLinkedInRoutes(app);
registerStoreCaptureRoutes(app);
registerProjectSetupRoutes(app);
registerOperationsRoutes(app);
registerBusinessRoutes(app);
registerInsightRoutes(app);

app.get('/api/v1/me/notifications', async request => {
  const identity = await verifyRequestIdentity(request); const authority = await resolveAuthority(identity);
  requirePermission(authority, 'field.capture');
  const { firestore } = getFirebaseAdminServices();
  const snapshot = await firestore.collection('projectNotifications').where('workspaceId', '==', authority.workspaceId).where('recipientUserId', '==', identity.uid).get();
  const selected = snapshot.docs.filter(d => ['STORE_REDO_REQUIRED', 'STORE_REJECTED'].includes(d.get('type'))).sort((a,b) => String(b.get('createdAt')).localeCompare(String(a.get('createdAt')))).slice(0,100);
  const notifications = await Promise.all(selected.map(async d => {
    const capture = await firestore.collection('storeCaptures').doc(String(d.get('storeCaptureId'))).get();
    const owned = capture.get('workspaceId') === authority.workspaceId && capture.get('capturerUserId') === identity.uid;
    const assignmentId = owned ? capture.get('assignmentId') : null;
    return { id:d.id, title:d.get('title'), message:d.get('message'), type:d.get('type'), createdAt:d.get('createdAt'), storeCaptureId:d.get('storeCaptureId'), assignmentId,
      canCorrect: owned && d.get('type') === 'STORE_REDO_REQUIRED' && capture.get('status') === 'NEEDS_REVIEW' && authority.assignmentIds.has(assignmentId) };
  }));
  return { notifications, channel:'IN_APP' };
});

app.get('/health', async () => ({ service: 'survey-guru-api', status: 'ok', authority: 'api', firebaseConfigured: isFirebaseAdminConfigured() }));
app.get('/api/v1/runtime', async () => ({ environment: process.env.SURVEY_GURU_ENV ?? 'local', authentication: isFirebaseAdminConfigured() ? 'firebase-admin-configured' : 'not-configured', protectedBusinessEndpoints: 'project-assignment-search-session-and-movement-authorisation' }));
app.get('/api/v1/me', async (request) => { const identity = await verifyRequestIdentity(request); const authority = await resolveAuthority(identity); return { identity, authority: { status: 'authorised', workspaceMembership: { id: authority.membershipId, workspaceId: authority.workspaceId, roleKey: authority.roleKey }, permissions: [...authority.permissions], projectIds: [...authority.projectIds], assignmentIds: [...authority.assignmentIds], resourceScope: 'workspace' } }; });

app.get('/api/v1/projects/active', async (request) => {
  const identity = await verifyRequestIdentity(request);
  const authority = await resolveAuthority(identity);
  requirePermission(authority, 'project.read');
  const { firestore } = getFirebaseAdminServices();
  const snapshot = await firestore.collection('projects').where('workspaceId', '==', authority.workspaceId).where('status', '==', 'active').get();
  const administrator = authority.permissions.has('workspace.admin');
  const projects = snapshot.docs
    .filter((document) => administrator || authority.projectIds.has(document.id))
    .map((document) => ({ id: document.id, name: document.get('name') ?? document.id, status: document.get('status'), publishedAt: document.get('publishedAt') ?? null, boundaryAreaSquareKm: document.get('boundaryAreaSquareKm') ?? null }))
    .sort((left, right) => String(right.publishedAt ?? '').localeCompare(String(left.publishedAt ?? '')));
  return { projects, selectedProjectIds: projects.map((project) => project.id), authority: { canCreateProjects: administrator, projectScoped: !administrator, workspaceId: authority.workspaceId } };
});

app.get<{ Params: { projectId: string } }>('/api/v1/projects/:projectId/summary', async (request) => {
  const identity = await verifyRequestIdentity(request); const authority = await resolveAuthority(identity); requirePermission(authority, 'project.read'); requireProjectScope(authority, request.params.projectId);
  const { firestore } = getFirebaseAdminServices(); const project = await firestore.collection('projects').doc(request.params.projectId).get();
  if (!project.exists || project.get('workspaceId') !== authority.workspaceId) throw new AuthorisationError('Project is outside the authorised scope.');
  return { project: { id: project.id, name: project.get('name'), status: project.get('status'), summary: project.get('summary') }, authority: { permission: 'project.read', workspaceId: authority.workspaceId, projectScoped: true } };
});

app.get<{ Params: { projectId: string } }>('/api/v1/projects/:projectId/assignments/today', async (request) => {
  const identity = await verifyRequestIdentity(request); const authority = await resolveAuthority(identity); requirePermission(authority, 'assignment.read'); requireProjectScope(authority, request.params.projectId);
  const { firestore } = getFirebaseAdminServices(); const snapshot = await firestore.collection('assignments').where('workspaceId', '==', authority.workspaceId).where('projectId', '==', request.params.projectId).where('assignedUserId', '==', identity.uid).where('status', '==', 'active').get();
  return { assignments: snapshot.docs.map((document) => ({ id: document.id, ...document.data() })), authority: { permission: 'assignment.read', workspaceId: authority.workspaceId, projectScoped: true, identityScoped: true } };
});

app.get('/api/v1/assignments/today', async (request) => {
  const identity = await verifyRequestIdentity(request);
  const authority = await resolveAuthority(identity);
  requirePermission(authority, 'assignment.read');
  const { firestore } = getFirebaseAdminServices();
  const snapshot = await firestore.collection('assignments').where('workspaceId', '==', authority.workspaceId).where('assignedUserId', '==', identity.uid).where('status', '==', 'active').get();
  const correctionsSnapshot = await firestore.collection('storeCaptures').where('workspaceId', '==', authority.workspaceId).where('capturerUserId', '==', identity.uid).get();
  const corrections = correctionsSnapshot.docs
    .filter((document) => document.get('status') === 'NEEDS_REVIEW' && authority.assignmentIds.has(String(document.get('assignmentId'))))
    .map((document) => ({ id: document.id, assignmentId: document.get('assignmentId'), projectId: document.get('projectId'), observedName: document.get('observedName'), reason: document.get('correctionReason') ?? 'The store capture needs to be redone.', returnedAt: document.get('lastReviewedAt') ?? document.get('updatedAt') }));
  const captureSummary = {
    total: correctionsSnapshot.docs.filter((document) => document.get('status') !== 'DRAFT').length,
    accepted: correctionsSnapshot.docs.filter((document) => ['VERIFIED', 'READY_FOR_EXPORT', 'SYNCED'].includes(String(document.get('status')))).length,
    inReview: correctionsSnapshot.docs.filter((document) => document.get('status') === 'SUBMITTED').length,
    returnedForRedo: corrections.length,
  };
  const authorised = snapshot.docs.filter((document) => authority.assignmentIds.has(document.id) && authority.projectIds.has(document.get('projectId')));
  const assignments = await Promise.all(authorised.map(async (document) => {
    const data = document.data() as Record<string, unknown>;
    const projectId = document.get('projectId');
    const project = typeof projectId === 'string' ? await firestore.collection('projects').doc(projectId).get() : null;
    return { id: document.id, ...data, assignedAt: data['assignedAt'], createdAt: data['createdAt'], projectName: project?.exists ? project.get('name') : 'Assigned project' };
  }));
  assignments.sort((left, right) => String(right.assignedAt ?? right.createdAt ?? '').localeCompare(String(left.assignedAt ?? left.createdAt ?? '')));
  return { assignments, corrections, captureSummary, authority: { permission: 'assignment.read', workspaceId: authority.workspaceId, identityScoped: true } };
});

app.post<{ Params: { assignmentId: string } }>('/api/v1/assignments/:assignmentId/search-session', async (request) => {
  const identity = await verifyRequestIdentity(request); const authority = await resolveAuthority(identity); requirePermission(authority, 'field.capture'); requireAssignmentScope(authority, request.params.assignmentId);
  const { firestore } = getFirebaseAdminServices(); const assignment = await firestore.collection('assignments').doc(request.params.assignmentId).get();
  if (!assignment.exists || assignment.get('assignedUserId') !== identity.uid || assignment.get('workspaceId') !== authority.workspaceId) throw new AuthorisationError('Assignment is outside the authorised scope.');
  const projectId = assignment.get('projectId'); if (typeof projectId !== 'string') throw new AuthorisationError('Assignment project scope is invalid.'); requireProjectScope(authority, projectId);
  const sessionId = `ss_${assignment.id}`; const sessionRef = firestore.collection('searchSessions').doc(sessionId); const existing = await sessionRef.get();
  if (!existing.exists) await sessionRef.set({ workspaceId: authority.workspaceId, projectId, assignmentId: assignment.id, userId: identity.uid, teamId: assignment.get('teamId'), areaName: assignment.get('areaName'), state: 'READY', coverageState: 'UNCOVERED', searchedKm: 0, partialKm: 0, unknownKm: assignment.get('outstandingKm') ?? 0, queuedEvidenceCount: 0, acceptedEvidenceCount: 0, rejectedEvidenceCount: 0, coveragePolicyId: assignment.get('coveragePolicyId'), environment: process.env.SURVEY_GURU_ENV ?? 'local', updatedAt: new Date().toISOString() });
  const session = await sessionRef.get(); return { searchSession: { id: session.id, ...session.data() }, authority: { permission: 'field.capture', assignmentScoped: true, projectScoped: true } };
});

async function getAuthorisedSession(request: Parameters<typeof verifyRequestIdentity>[0], sessionId: string) {
  const identity = await verifyRequestIdentity(request); const authority = await resolveAuthority(identity); requirePermission(authority, 'field.capture');
  const { firestore } = getFirebaseAdminServices(); const session = await firestore.collection('searchSessions').doc(sessionId).get();
  if (!session.exists || session.get('userId') !== identity.uid || session.get('workspaceId') !== authority.workspaceId) throw new AuthorisationError('Search session is outside the authorised scope.');
  const assignmentId = session.get('assignmentId'); const projectId = session.get('projectId');
  if (typeof assignmentId !== 'string' || typeof projectId !== 'string') throw new AuthorisationError('Search session scope is invalid.');
  requireAssignmentScope(authority, assignmentId); requireProjectScope(authority, projectId);
  return { identity, authority, firestore, session, assignmentId, projectId };
}

app.get<{ Params: { sessionId: string } }>('/api/v1/search-sessions/:sessionId', async (request) => {
  const { authority, session } = await getAuthorisedSession(request, request.params.sessionId);
  return { searchSession: { id: session.id, ...session.data() }, authority: { permission: 'field.capture', assignmentScoped: true, projectScoped: true, identityScoped: true, workspaceId: authority.workspaceId } };
});

app.post<{ Params: { sessionId: string } }>('/api/v1/search-sessions/:sessionId/start', async (request) => {
  const { authority, firestore, session } = await getAuthorisedSession(request, request.params.sessionId);
  const state = session.get('state');
  if (state !== 'READY' && state !== 'PAUSED' && state !== 'ACTIVE_SEARCH') throw new AuthorisationError('Search session cannot be started from its current state.');
  if (state !== 'ACTIVE_SEARCH') await session.ref.update({ state: 'ACTIVE_SEARCH', startedAt: session.get('startedAt') ?? new Date().toISOString(), updatedAt: new Date().toISOString() });
  const updated = await firestore.collection('searchSessions').doc(session.id).get();
  return { searchSession: { id: updated.id, ...updated.data() }, authority: { permission: 'field.capture', assignmentScoped: true, projectScoped: true, identityScoped: true, workspaceId: authority.workspaceId } };
});

type MovementBody = { capturedAt?: unknown; latitude?: unknown; longitude?: unknown; accuracyMetres?: unknown; source?: unknown };
type MovementPoint = { id?: string; capturedAt?: unknown; latitude?: unknown; longitude?: unknown; accuracyMetres?: unknown; validationStatus?: unknown };
function finiteNumber(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }
function radians(value: number) { return value * Math.PI / 180; }
function distanceMetres(a: MovementPoint, b: { latitude: number; longitude: number }) {
  if (!finiteNumber(a.latitude) || !finiteNumber(a.longitude)) return Number.POSITIVE_INFINITY;
  const earth = 6_371_000; const dLat = radians(b.latitude - a.latitude); const dLon = radians(b.longitude - a.longitude); const lat1 = radians(a.latitude); const lat2 = radians(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earth * Math.asin(Math.sqrt(h));
}
function acceptedMovementPoint(point: MovementPoint): AcceptedMovementPoint | null {
  if (point.validationStatus !== 'ACCEPTED' || typeof point.id !== 'string' || typeof point.capturedAt !== 'string' || !finiteNumber(point.latitude) || !finiteNumber(point.longitude) || !finiteNumber(point.accuracyMetres)) return null;
  return { id: point.id, capturedAt: point.capturedAt, latitude: point.latitude, longitude: point.longitude, accuracyMetres: point.accuracyMetres, validationStatus: 'ACCEPTED' };
}
function deriveTraversal(points: MovementPoint[]) {
  const accepted = points.filter((point) => point.validationStatus === 'ACCEPTED' && typeof point.capturedAt === 'string' && finiteNumber(point.latitude) && finiteNumber(point.longitude)).sort((a, b) => Date.parse(String(a.capturedAt)) - Date.parse(String(b.capturedAt)));
  const segments: Array<{ fromEventId: string | undefined; toEventId: string | undefined; metres: number; elapsedSeconds: number; status: 'SUPPORTED' | 'EXCLUDED_GAP'; reason: string }> = [];
  for (let index = 1; index < accepted.length; index += 1) {
    const from = accepted[index - 1]; const to = accepted[index]; if (!from || !to || !finiteNumber(to.latitude) || !finiteNumber(to.longitude)) continue;
    const elapsedSeconds = (Date.parse(String(to.capturedAt)) - Date.parse(String(from.capturedAt))) / 1000; const metres = distanceMetres(from, { latitude: to.latitude, longitude: to.longitude });
    if (elapsedSeconds <= 0 || elapsedSeconds > 10 * 60) segments.push({ fromEventId: from.id, toEventId: to.id, metres: Math.round(metres), elapsedSeconds, status: 'EXCLUDED_GAP', reason: 'Segment is not continuous enough to support traversal evidence.' });
    else segments.push({ fromEventId: from.id, toEventId: to.id, metres: Math.round(metres), elapsedSeconds, status: 'SUPPORTED', reason: 'Consecutive accepted points support candidate traversal only.' });
  }
  const supportedMetres = segments.filter((segment) => segment.status === 'SUPPORTED').reduce((total, segment) => total + segment.metres, 0);
  return { acceptedPointCount: accepted.length, segmentCount: segments.length, supportedSegmentCount: segments.filter((segment) => segment.status === 'SUPPORTED').length, supportedTraversalKm: Math.round(supportedMetres) / 1000, derivationStatus: accepted.length < 2 ? 'INSUFFICIENT_SEQUENCE' : supportedMetres === 0 ? 'NO_SUPPORTED_SEGMENTS' : 'CANDIDATE_TRAVERSAL', coverageDerived: false, coverageReason: 'Traversal distance is evidence of movement, not proof that roads, streets or stores were searched.', segments };
}

app.post<{ Params: { sessionId: string }; Body: unknown }>('/api/v1/search-sessions/:sessionId/movement-events', async (request, reply) => {
  const { identity, authority, firestore, session, assignmentId, projectId } = await getAuthorisedSession(request, request.params.sessionId);
  let input;
  try { input = parseMovement(request.body); } catch (error) { return reply.code(422).send({ message: (error as Error).message }); }
  const fingerprint = movementFingerprint(input);
  const ref = firestore.collection('movementEvents').doc(movementKey(identity.uid, session.id, input.eventId));
  const receivedAt = new Date().toISOString();
  const saved = await firestore.runTransaction(async (tx) => {
    const [current, existing, assignment, membership, user, role, project] = await tx.getAll(
      session.ref, ref, firestore.collection('assignments').doc(assignmentId),
      firestore.collection('workspaceMemberships').doc(authority.membershipId), firestore.collection('users').doc(identity.uid),
      firestore.collection('roleDefinitions').doc(authority.roleKey), firestore.collection('projects').doc(projectId));
    if (!current || !existing || !assignment || !membership || !user || !role || !project) throw new AuthorisationError('Tracking authority unavailable.');
    if (current.get('state') !== 'ACTIVE_SEARCH' || assignment.get('status') !== 'active' || assignment.get('assignedUserId') !== identity.uid || membership.get('status') !== 'active' || membership.get('roleKey') !== authority.roleKey || user.get('status') !== 'active' || !(role.get('permissions') ?? []).includes('field.capture') || project.get('status') !== 'active') throw new AuthorisationError('Tracking is no longer authorised.');
    if (existing.exists) {
      if (existing.get('fingerprint') !== fingerprint) throw new AuthorisationError('Movement event ID was reused for different evidence.');
      return existing.data()!;
    }
    let previous = (current.get('lastAcceptedMovement') ?? null) as Point | null;
    // Bootstrap the pointer for sessions created before the durable queue release.
    if (!previous && Number(current.get('acceptedEvidenceCount') ?? 0) > 0) {
      const history = await tx.get(firestore.collection('movementEvents').where('searchSessionId', '==', session.id));
      previous = history.docs.filter(d => d.get('workspaceId') === authority.workspaceId && d.get('validationStatus') === 'ACCEPTED')
        .map(d => ({ id: d.id, ...d.data() } as Point)).sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0] ?? null;
    }
    const validation = validateMovement(input, previous);
    const accepted = validation.status === 'ACCEPTED';
    const record = { ...input, fingerprint, workspaceId: authority.workspaceId, projectId, assignmentId, searchSessionId: session.id,
      userId: identity.uid, receivedAt, validationStatus: validation.status, validationReason: validation.reason,
      previousAccepted: previous, mapMatchStatus: accepted ? 'PENDING' : 'NOT_APPLICABLE' };
    tx.create(ref, record);
    tx.update(session.ref, { queuedEvidenceCount: Number(current.get('queuedEvidenceCount') ?? 0) + 1,
      acceptedEvidenceCount: Number(current.get('acceptedEvidenceCount') ?? 0) + (accepted ? 1 : 0),
      rejectedEvidenceCount: Number(current.get('rejectedEvidenceCount') ?? 0) + (accepted ? 0 : 1),
      ...(accepted ? { lastAcceptedMovement: { id: ref.id, capturedAt: input.capturedAt, latitude: input.latitude, longitude: input.longitude, accuracyMetres: input.accuracyMetres, validationStatus: 'ACCEPTED' } } : {}),
      lastEvidenceAt: receivedAt, updatedAt: receivedAt });
    return record;
  });
  // Retry the ORIGINAL pair after a lost response. Map-match persistence is itself idempotent.
  let match: { status: string; contributionCreated: boolean; persistence: string; reason: string; mapMatchEvidenceId: string | null } = {
    status: saved['validationStatus'] === 'ACCEPTED' ? 'AWAITING_NEXT_POINT' : 'NOT_APPLICABLE', contributionCreated: false,
    persistence: 'NOT_APPLICABLE', reason: String(saved['validationReason']), mapMatchEvidenceId: null };
  if (saved['validationStatus'] === 'ACCEPTED' && saved['previousAccepted']) {
    match = await reconcileAcceptedMovementPair(firestore, { workspaceId: authority.workspaceId, projectId, searchSessionId: session.id,
      userId: identity.uid, coveragePolicyId: session.get('coveragePolicyId'), from: saved['previousAccepted'] as Point,
      to: { id: ref.id, capturedAt: input.capturedAt, latitude: input.latitude, longitude: input.longitude, accuracyMetres: input.accuracyMetres, validationStatus: 'ACCEPTED' }, createdAt: String(saved['receivedAt']) });
  }
  await ref.update({ mapMatchStatus: match.status, mapMatchEvidenceId: match.mapMatchEvidenceId, mapMatchUpdatedAt: new Date().toISOString() });
  return { movementEvent: { id: ref.id, capturedAt: input.capturedAt, accuracyMetres: input.accuracyMetres, source: input.source,
    validationStatus: saved['validationStatus'], validationReason: saved['validationReason'], mapMatchStatus: match.status },
    coverage: { changed: match.contributionCreated, matchOutcome: match.status, persistence: match.persistence, reason: match.reason } };
});

app.get<{ Params: { sessionId: string } }>('/api/v1/search-sessions/:sessionId/movement-events', async (request) => {
  const { authority, firestore, session } = await getAuthorisedSession(request, request.params.sessionId);
  const snapshot = await firestore.collection('movementEvents').where('workspaceId', '==', authority.workspaceId).where('searchSessionId', '==', session.id).get();
  const allEvents = snapshot.docs.map((document) => ({ id: document.id, ...document.data() } as MovementPoint)); const traversal = deriveTraversal(allEvents); const events = [...allEvents].sort((a, b) => String(b.capturedAt).localeCompare(String(a.capturedAt))).slice(0, 25);
  const acceptedCount = allEvents.filter((event) => event.validationStatus === 'ACCEPTED').length; const rejectedCount = allEvents.length - acceptedCount;
  return { movementEvents: events, evidence: { count: allEvents.length, acceptedCount, rejectedCount, coverageState: session.get('coverageState') ?? 'UNCOVERED', searchedKm: session.get('searchedKm') ?? 0, traversal }, authority: { permission: 'field.capture', identityScoped: true, workspaceId: authority.workspaceId } };
});

const port = Number(process.env.PORT ?? 8080); const host = process.env.HOST ?? '127.0.0.1'; app.listen({ port, host }).catch((error) => { app.log.error(error); process.exit(1); });
