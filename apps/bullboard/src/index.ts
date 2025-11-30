import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { HonoAdapter } from '@bull-board/hono';
import { createDeviceQueue } from '@vemetric/queues/create-device-queue';
import { createUserQueue } from '@vemetric/queues/create-user-queue';
import { emailDripQueue } from '@vemetric/queues/email-drip-queue';
import { enrichUserQueue } from '@vemetric/queues/enrich-user-queue';
import { eventQueue } from '@vemetric/queues/event-queue';
import { mergeUserQueue } from '@vemetric/queues/merge-user-queue';
import { sessionQueue } from '@vemetric/queues/session-queue';
import { updateUserQueue } from '@vemetric/queues/update-user-queue';
import { Hono } from 'hono';
import { basicAuth } from 'hono/basic-auth';
import { serveStatic } from 'hono/bun';
import { pinoLogger as honoPino } from 'hono-pino';
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

const serverAdapter = new HonoAdapter(serveStatic);

createBullBoard({
  queues: [
    new BullMQAdapter(createUserQueue),
    new BullMQAdapter(updateUserQueue),
    new BullMQAdapter(mergeUserQueue),
    new BullMQAdapter(enrichUserQueue),
    new BullMQAdapter(createDeviceQueue),
    new BullMQAdapter(eventQueue),
    new BullMQAdapter(sessionQueue),
    new BullMQAdapter(emailDripQueue),
  ],
  serverAdapter,
});

const username = process.env.BULLBOARD_USERNAME;
const password = process.env.BULLBOARD_PASSWORD;

if (!username || !password) {
  throw new Error('BULLBOARD_USERNAME and BULLBOARD_PASSWORD must be set');
}

const basePath = '/';
app.use(
  basePath,
  basicAuth({
    username,
    password,
  }),
);
serverAdapter.setBasePath(basePath);
app.route(basePath, serverAdapter.registerPlugin());

process.on('uncaughtException', function (err) {
  logger.error({ err }, 'Uncaught exception');
});
process.on('unhandledRejection', function (err) {
  logger.error({ err }, 'Unhandled rejection');
});

export default {
  port: 4121,
  fetch: app.fetch,
};

logger.info('Starting bullboard');
