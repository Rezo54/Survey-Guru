import Fastify from 'fastify';
import { AuthenticationError, verifyRequestIdentity } from './auth.js';
import { AuthorisationError, requireAssignmentScope, requirePermission, requireProjectScope, resolveAuthority } from './authority.js';
import { getFirebaseAdminServices, isFirebaseAdminConfigured } from './firebase-admin.js';

const app = Fastify({ logger: true });
const allowedWebOrigin = process.env.SURVEY_GURU_WEB_ORIGIN ?? 'http://localhost:3000';

app.addHook('onRequest', async (request, reply) => {
  const origin = request.headers.origin;
  if (origin === allowedWebOrigin) { reply.header('Access-Control-Allow-Origin', allowedWebOrigin); reply.header('Vary', 'Origin'); reply.header('Access-Control-Allow-Headers', 'Authorization, Content-Type'); reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); }
  if (request.method === 'OPTIONS') { if (origin !== allowedWebOrigin) return reply.code(403).send({ error: 'origin_not_allowed', message: 'The request origin is not authorised for this API.' }); return reply.code(204).send(); }
});

app.setErrorHandler((error, _request, reply) => {
  if (error instanceof AuthenticationError) return reply.code(error.statusCode).send({ error: 'unauthenticated', message: error.message });
  if (error instanceof AuthorisationError) return reply.code(error.statusCode).send({ error: 'forbidden', message: error.message });
  app.log.error(error); return reply.code(500).send({ error: 'internal_error', message: 'The request could not be completed.' });
});

app.get('/health', async () => ({ service: 'survey-guru-api', status: 'ok', authority: 'api', firebaseConfigured: isFirebaseAdminConfigured() }));
app.get('/api/v1/runtime', async () => ({ environment: process.env.SURVEY_GURU_ENV ?? 'local', authentication: isFirebaseAdminConfigured() ? 'firebase-admin-configured' : 'not-configured', protectedBusinessEndpoints: 'project-assignment-and-search-session-authorisation' }));
app.get('/api/v1/me', async (request) => { const identity = await verifyRequestIdentity(request); const authority = await resolveAuthority(identity); return { identity, authority: { status: 'authorised', workspaceMembership: { id: authority.membershipId, workspaceId: authority.workspaceId, roleKey: authority.roleKey }, permissions: [...authority.permissions], projectIds: [...authority.projectIds], assignmentIds: [...authority.assignmentIds], resourceScope: 'workspace' } }; });

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

app.post<{ Params: { assignmentId: string } }>('/api/v1/assignments/:assignmentId/search-session', async (request) => {
  const identity = await verifyRequestIdentity(request); const authority = await resolveAuthority(identity); requirePermission(authority, 'field.capture'); requireAssignmentScope(authority, request.params.assignmentId);
  const { firestore } = getFirebaseAdminServices(); const assignment = await firestore.collection('assignments').doc(request.params.assignmentId).get();
  if (!assignment.exists || assignment.get('assignedUserId') !== identity.uid || assignment.get('workspaceId') !== authority.workspaceId) throw new AuthorisationError('Assignment is outside the authorised scope.');
  const projectId = assignment.get('projectId'); if (typeof projectId !== 'string') throw new AuthorisationError('Assignment project scope is invalid.'); requireProjectScope(authority, projectId);
  const sessionId = `ss_${assignment.id}`; const sessionRef = firestore.collection('searchSessions').doc(sessionId); const existing = await sessionRef.get();
  if (!existing.exists) await sessionRef.set({ workspaceId: authority.workspaceId, projectId, assignmentId: assignment.id, userId: identity.uid, teamId: assignment.get('teamId'), areaName: assignment.get('areaName'), state: 'READY', coverageState: 'UNCOVERED', searchedKm: 0, partialKm: 0, unknownKm: assignment.get('outstandingKm') ?? 0, queuedEvidenceCount: 0, environment: process.env.SURVEY_GURU_ENV ?? 'local', updatedAt: new Date().toISOString() });
  const session = await sessionRef.get(); return { searchSession: { id: session.id, ...session.data() }, authority: { permission: 'field.capture', assignmentScoped: true, projectScoped: true } };
});

async function getAuthorisedSession(request: Parameters<typeof verifyRequestIdentity>[0], sessionId: string) {
  const identity = await verifyRequestIdentity(request); const authority = await resolveAuthority(identity); requirePermission(authority, 'field.capture');
  const { firestore } = getFirebaseAdminServices(); const session = await firestore.collection('searchSessions').doc(sessionId).get();
  if (!session.exists || session.get('userId') !== identity.uid || session.get('workspaceId') !== authority.workspaceId) throw new AuthorisationError('Search session is outside the authorised scope.');
  const assignmentId = session.get('assignmentId'); const projectId = session.get('projectId');
  if (typeof assignmentId !== 'string' || typeof projectId !== 'string') throw new AuthorisationError('Search session scope is invalid.');
  requireAssignmentScope(authority, assignmentId); requireProjectScope(authority, projectId);
  return { identity, authority, firestore, session };
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

const port = Number(process.env.PORT ?? 8080); const host = process.env.HOST ?? '127.0.0.1'; app.listen({ port, host }).catch((error) => { app.log.error(error); process.exit(1); });
