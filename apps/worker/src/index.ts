import { assertBooleanEnvFlags } from '@vemetric/common/self-hosted';
import { assertMailConfig } from '@vemetric/email/transactional';
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

// Runs outside main() on purpose: main() only logs its errors, and a mail setup that bounces
// every message has to stop the worker from starting.
assertMailConfig();

// The worker reads SELF_HOSTED when it sets up its analytics client. A malformed value has to
// stop the start here instead of deciding the behaviour of a single module load later on.
assertBooleanEnvFlags(['SELF_HOSTED']);

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
  // Configurable so several worker processes can run on one machine (e.g. load tests).
  port: Number(process.env.WORKER_HEALTH_PORT ?? 4101),
  fetch(request) {
    if (request.url.endsWith('/up')) {
      return new Response(ready ? 'UP' : 'STARTING', { status: ready ? 200 : 503 });
    }
    return new Response('NOT FOUND', { status: 404 });
  },
});
