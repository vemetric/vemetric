import * as Sentry from '@sentry/bun';
import { clickhouseClient } from 'clickhouse';
import { Hono } from 'hono';
import { createPublicApi } from './api';
import { createBackendApp } from './backend-app';
import { createStaticApp } from './static-app';
import { logger } from './utils/logger';

if (process.env.SENTRY_URL) {
  Sentry.init({
    dsn: process.env.SENTRY_URL,
    integrations: [],
    tracesSampleRate: 0.5,
  });
}

export const app = new Hono();

const backendApp = createBackendApp();
const publicApi = createPublicApi();

app.route('/_api', backendApp);
app.route('/api', publicApi);

if (process.env.NODE_ENV === 'production') {
  const staticApp = createStaticApp();
  app.route('/', staticApp);
}

export default {
  port: 4000,
  fetch: app.fetch,
};

process.on('uncaughtException', function (err) {
  logger.error({ err }, 'Uncaught exception');
});
process.on('unhandledRejection', function (err) {
  logger.error({ err }, 'Unhandled rejection');
});

process.on('beforeExit', () => {
  clickhouseClient.close();
});

logger.info('Starting app');
