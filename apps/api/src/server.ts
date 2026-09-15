import Fastify from 'fastify';
import { AuthenticationError, verifyRequestIdentity } from './auth.js';
import { isFirebaseAdminConfigured } from './firebase-admin.js';

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
    return reply.code(error.statusCode).send({
      error: 'unauthenticated',
      message: error.message,
    });
  }

  app.log.error(error);
  return reply.code(500).send({
    error: 'internal_error',
    message: 'The request could not be completed.',
  });
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
  protectedBusinessEndpoints: 'identity-checkpoint-only',
}));

app.get('/api/v1/me', async (request) => {
  const identity = await verifyRequestIdentity(request);

  return {
    identity,
    authority: {
      status: 'identity-verified',
      workspaceMembership: 'not-resolved',
      permissions: 'not-resolved',
      resourceScope: 'not-resolved',
    },
  };
});

const port = Number(process.env.PORT ?? 8080);
const host = process.env.HOST ?? '127.0.0.1';

app.listen({ port, host }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
