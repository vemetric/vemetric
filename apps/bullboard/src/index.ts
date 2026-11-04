import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { HonoAdapter } from '@bull-board/hono';
import { createDeviceQueue } from '@vemetric/queues/create-device-queue';
import { createUserQueue } from '@vemetric/queues/create-user-queue';
import { emailDripQueue } from '@vemetric/queues/email-drip-queue';
import { enrichUserQueue } from '@vemetric/queues/enrich-user-queue';
import { eventQueue } from '@vemetric/queues/event-queue';
import { mergeUserQueue } from '@vemetric/queues/merge-user-queue';
import { sessionFlushQueue } from '@vemetric/queues/session-flush-queue';
import { sessionQueue } from '@vemetric/queues/session-queue';
import { updateUserQueue } from '@vemetric/queues/update-user-queue';
import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { pinoLogger as honoPino } from 'hono-pino';
import { createAuthMiddleware } from './auth';
import { logger } from './logger';

const app = new Hono();

app.use(
  honoPino({
    pino: logger,
    http: {
      onReqBindings: (c) => {
        return {
          url: c.req.path,
          method: c.req.method,
          headers: {
            'v-host': c.req.header('v-host') || '',
            'v-referrer': c.req.header('v-referrer') || '',
            'v-sdk': c.req.header('v-sdk') || '',
            'v-sdk-version': c.req.header('v-sdk-version') || '',
          },
        };
      },
      onResLevel: (c) => (c.error ? 'error' : 'trace'),
    },
  }),
);

// Protect every path, including the /api routes that can retry, remove or clean jobs
app.use('*', createAuthMiddleware());

const serverAdapter = new HonoAdapter(serveStatic);

// BULLBOARD_READ_ONLY=true hides all actions that modify queues or jobs
const readOnlyMode = process.env.BULLBOARD_READ_ONLY === 'true';

createBullBoard({
  queues: [
    createUserQueue,
    updateUserQueue,
    mergeUserQueue,
    enrichUserQueue,
    createDeviceQueue,
    eventQueue,
    sessionQueue,
    sessionFlushQueue,
    emailDripQueue,
  ].map((queue) => new BullMQAdapter(queue, { readOnlyMode })),
  serverAdapter,
});

const basePath = '/';
serverAdapter.setBasePath(basePath);
app.route(basePath, serverAdapter.registerPlugin());

process.on('uncaughtException', function (err) {
  logger.error({ err }, 'Uncaught exception');
});
process.on('unhandledRejection', function (err) {
  logger.error({ err }, 'Unhandled rejection');
});

const server = Bun.serve({
  port: 4121,
  fetch: app.fetch,
});

const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, closing server...`);
  try {
    await server.stop();
  } catch (err) {
    logger.error({ err }, 'Error during graceful shutdown');
    process.exit(1);
  }
  process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

logger.info('Starting bullboard');
