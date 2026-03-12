import * as Sentry from '@sentry/bun';
import { clickhouseClient } from 'clickhouse';
import { Hono } from 'hono';
import { API_DOCS_URL, createPublicApi } from './api';
import { createBackendApp } from './backend-app';
import { createStaticApp } from './static-app';
import { logger } from './utils/backend-logger';

if (process.env.SENTRY_URL) {
  Sentry.init({
    dsn: process.env.SENTRY_URL,
    integrations: [],
    tracesSampleRate: 0.5,
  });
}

export const app = new Hono();

const backendApp = createBackendApp();
app.route('/_api', backendApp);

const publicApi = createPublicApi();
app.get('/api', (c) => c.redirect(API_DOCS_URL, 302));
app.get('/api/', (c) => c.redirect(API_DOCS_URL, 302));
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
