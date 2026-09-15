import Fastify from 'fastify';
import { AuthenticationError, verifyRequestIdentity } from './auth.js';
import { isFirebaseAdminConfigured } from './firebase-admin.js';

const app = Fastify({ logger: true });

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
