import Fastify from 'fastify';
import { AuthenticationError, verifyRequestIdentity } from './auth.js';
import {
  AuthorisationError,
  requirePermission,
  requireProjectScope,
  resolveAuthority,
} from './authority.js';
import { getFirebaseAdminServices, isFirebaseAdminConfigured } from './firebase-admin.js';

const app = Fastify({ logger: true });

const allowedWebOrigin = process.env.SURVEY_GURU_WEB_ORIGIN ?? 'http://localhost:3000';

app.addHook('onRequest', async (request, reply) => {
  const origin = request.headers.origin;

  if (origin === allowedWebOrigin) {
    reply.header('Access-Control-Allow-Origin', allowedWebOrigin);
    reply.header('Vary', 'Origin');
    reply.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    reply.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  }

  if (request.method === 'OPTIONS') {
    if (origin !== allowedWebOrigin) {
      return reply.code(403).send({
        error: 'origin_not_allowed',
        message: 'The request origin is not authorised for this API.',
      });
    }

    return reply.code(204).send();
  }
});

app.setErrorHandler((error, _request, reply) => {
  if (error instanceof AuthenticationError) {
    return reply.code(error.statusCode).send({ error: 'unauthenticated', message: error.message });
  }
  if (error instanceof AuthorisationError) {
    return reply.code(error.statusCode).send({ error: 'forbidden', message: error.message });
  }
  app.log.error(error);
  return reply.code(500).send({ error: 'internal_error', message: 'The request could not be completed.' });
});

app.get('/health', async () => ({
  service: 'survey-guru-api',
  status: 'ok',
  authority: 'api',
  firebaseConfigured: isFirebaseAdminConfigured(),
}));

app.get('/api/v1/runtime', async () => ({
  environment: process.env.SURVEY_GURU_ENV ?? 'local',
  authentication: isFirebaseAdminConfigured() ? 'firebase-admin-configured' : 'not-configured',
  protectedBusinessEndpoints: 'project-and-assignment-authorisation',
}));

app.get('/api/v1/me', async (request) => {
  const identity = await verifyRequestIdentity(request);
  const authority = await resolveAuthority(identity);
  return {
    identity,
    authority: {
      status: 'authorised',
      workspaceMembership: { id: authority.membershipId, workspaceId: authority.workspaceId, roleKey: authority.roleKey },
      permissions: [...authority.permissions],
      projectIds: [...authority.projectIds],
      resourceScope: 'workspace',
    },
  };
});

app.get<{ Params: { projectId: string } }>('/api/v1/projects/:projectId/summary', async (request) => {
  const identity = await verifyRequestIdentity(request);
  const authority = await resolveAuthority(identity);
  requirePermission(authority, 'project.read');
  requireProjectScope(authority, request.params.projectId);

  const { firestore } = getFirebaseAdminServices();
  const project = await firestore.collection('projects').doc(request.params.projectId).get();
  if (!project.exists || project.get('workspaceId') !== authority.workspaceId) {
    throw new AuthorisationError('Project is outside the authorised scope.');
  }

  return {
    project: { id: project.id, name: project.get('name'), status: project.get('status'), summary: project.get('summary') },
    authority: { permission: 'project.read', workspaceId: authority.workspaceId, projectScoped: true },
  };
});

app.get<{ Params: { projectId: string } }>('/api/v1/projects/:projectId/assignments/today', async (request) => {
  const identity = await verifyRequestIdentity(request);
  const authority = await resolveAuthority(identity);
  requirePermission(authority, 'assignment.read');
  requireProjectScope(authority, request.params.projectId);

  const { firestore } = getFirebaseAdminServices();
  const snapshot = await firestore
    .collection('assignments')
    .where('workspaceId', '==', authority.workspaceId)
    .where('projectId', '==', request.params.projectId)
    .where('assignedUserId', '==', identity.uid)
    .where('status', '==', 'active')
    .get();

  return {
    assignments: snapshot.docs.map((document) => ({ id: document.id, ...document.data() })),
    authority: { permission: 'assignment.read', workspaceId: authority.workspaceId, projectScoped: true, identityScoped: true },
  };
});

const port = Number(process.env.PORT ?? 8080);
const host = process.env.HOST ?? '127.0.0.1';
app.listen({ port, host }).catch((error) => { app.log.error(error); process.exit(1); });
