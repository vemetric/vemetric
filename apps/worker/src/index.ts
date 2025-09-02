import type { Worker } from 'bullmq';
import { logger } from './utils/logger';
import { initCreateUserWorker } from './workers/create-user-worker';
import { initDeviceWorker } from './workers/device-worker';
import { initEmailWorker } from './workers/email-worker';
import { initEnrichUserWorker } from './workers/enrich-user-worker';
import { initEventWorker } from './workers/event-worker';
import { initFirstEventWorker } from './workers/first-event-worker';
import { initMergeUserWorker } from './workers/merge-user-worker';
import { initSaltRotation } from './workers/salt-rotation-worker';
import { initSessionWorker } from './workers/session-worker';
import { initUpdateUserWorker } from './workers/update-user-worker';

const workers: Worker[] = [];
async function main() {
  try {
    workers.push(await initSaltRotation());
    workers.push(await initFirstEventWorker());
    workers.push(await initEventWorker());
    workers.push(await initSessionWorker());
    workers.push(await initCreateUserWorker());
    workers.push(await initUpdateUserWorker());
    workers.push(await initEnrichUserWorker());
    workers.push(await initMergeUserWorker());
    workers.push(await initDeviceWorker());
    workers.push(await initEmailWorker());

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

    logger.info('workers started');
  } catch (err) {
    logger.error({ err }, 'Error initializing worker');
  }
}

process.on('uncaughtException', function (err) {
  logger.error({ err }, 'Uncaught exception');
});
process.on('unhandledRejection', function (err) {
  logger.error({ err }, 'Unhandled rejection');
});

const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, closing server...`);
  await Promise.all(workers.map((worker) => worker.close()));
  process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

main();

Bun.serve({
  port: 4101,
  fetch(request) {
    if (request.url.endsWith('/up')) {
      return new Response('UP', { status: 200 });
    }
    return new Response('NOT FOUND', { status: 404 });
  },
});
