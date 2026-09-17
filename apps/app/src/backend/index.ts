import * as Sentry from '@sentry/bun';
import { assertBooleanEnvFlags } from '@vemetric/common/self-hosted';
import { assertMailConfig } from '@vemetric/email/transactional';
import { clickhouseClient } from 'clickhouse';
import { Hono } from 'hono';
import { API_DOCS_URL, createPublicApi } from './api';
import { createBackendApp } from './backend-app';
import { createStaticApp } from './static-app';
import { logger } from './utils/backend-logger';
import { isMemoryReportEnabled, memoryTelemetryMiddleware, startMemoryReportSchedule } from './utils/memory-report';

if (process.env.SENTRY_URL) {
  Sentry.init({
    dsn: process.env.SENTRY_URL,
    integrations: [],
    tracesSampleRate: 0.5,
  });
}

// Fails the start instead of letting every mail silently bounce later.
assertMailConfig();

// A mistyped switch must not decide at runtime whether registration is open or whether
// billing applies, so both are parsed once here and fail the start when malformed.
assertBooleanEnvFlags(['SELF_HOSTED', 'ALLOW_REGISTRATION']);

export const app = new Hono();

if (isMemoryReportEnabled()) {
  app.use('*', memoryTelemetryMiddleware);
}

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

if (isMemoryReportEnabled()) {
  startMemoryReportSchedule();
}

logger.info('Starting app');
