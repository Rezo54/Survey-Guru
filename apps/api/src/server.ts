import Fastify from 'fastify';

const app = Fastify({ logger: true });

app.get('/health', async () => ({
  service: 'survey-guru-api',
  status: 'ok',
  authority: 'api',
  firebaseConfigured: Boolean(process.env.FIREBASE_PROJECT_ID)
}));

app.get('/api/v1/runtime', async () => ({
  environment: process.env.SURVEY_GURU_ENV ?? 'local',
  authentication: process.env.FIREBASE_PROJECT_ID ? 'firebase-configured' : 'not-configured',
  protectedBusinessEndpoints: 'not-enabled-until-server-auth-is-configured'
}));

const port = Number(process.env.PORT ?? 8080);
const host = process.env.HOST ?? '127.0.0.1';

app.listen({ port, host }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
