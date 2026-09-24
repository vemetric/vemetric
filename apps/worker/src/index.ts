import type { Worker } from 'bullmq';
import { closeStateRedis } from './ingestion';
import { logger } from './utils/logger';
import { shutdownQueueTelemetry } from './utils/telemetry';
import { initCreateUserWorker } from './workers/create-user-worker';
import { initDeviceWorker } from './workers/device-worker';
import { initEmailWorker } from './workers/email-worker';
import { initEnrichUserWorker } from './workers/enrich-user-worker';
import { initEventWorker } from './workers/event-worker';
import { initFirstEventWorker } from './workers/first-event-worker';
import { initMergeUserWorker } from './workers/merge-user-worker';
import { initMetricsWorker } from './workers/metrics-worker';
import { initSaltRotation } from './workers/salt-rotation-worker';
import { initSessionFlushWorker } from './workers/session-flush-worker';
import { initSessionWorker } from './workers/session-worker';
import { initUpdateUserWorker } from './workers/update-user-worker';

const workers: Worker[] = [];
const initializers = {
  salt: initSaltRotation,
  'first-event': initFirstEventWorker,
  event: initEventWorker,
  session: initSessionWorker,
  'session-flush': initSessionFlushWorker,
  device: initDeviceWorker,
  'create-user': initCreateUserWorker,
  'update-user': initUpdateUserWorker,
  'enrich-user': initEnrichUserWorker,
  'merge-user': initMergeUserWorker,
  email: initEmailWorker,
  metrics: initMetricsWorker,
};
let ready = false;
async function main() {
  try {
    for (const initialize of Object.values(initializers)) {
      workers.push(await initialize());
    }

    workers.forEach((worker) => {
      worker.on('failed', (job, err) => {
        logger.error({ err, name: worker.name }, `❌ Failed: ${job?.id}`);
      });

      worker.on('stalled', (jobId) => {
        logger.warn({ jobId, name: worker.name }, `⚠️ Stalled: ${jobId}`);
      });

      worker.on('error', (err) => {
        logger.error({ err, name: worker.name }, `🔥 Worker error`);
      });

      worker.on('ioredis:close', () => {
        logger.error({ name: worker.name }, 'worker closed: ioredis:close');
      });
    });

    ready = true;
    logger.info({ workers: Object.keys(initializers) }, 'workers started');
  } catch (err) {
    logger.error({ err }, 'Error initializing worker');
    process.exit(1);
  }
}

process.on('uncaughtException', function (err) {
  logger.error({ err }, 'Uncaught exception');
});
process.on('unhandledRejection', function (err) {
  logger.error({ err }, 'Unhandled rejection');
});

const gracefulShutdown = async (signal: string) => {
  ready = false;
  logger.info(`Received ${signal}, closing server...`);
  await Promise.all(workers.map((worker) => worker.close()));
  await shutdownQueueTelemetry();
  await closeStateRedis();
  process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

main();

Bun.serve({
  port: 4101,
  fetch(request) {
    if (request.url.endsWith('/up')) {
      return new Response(ready ? 'UP' : 'STARTING', { status: ready ? 200 : 503 });
    }
    return new Response('NOT FOUND', { status: 404 });
  },
});
