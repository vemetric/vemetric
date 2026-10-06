import { saltRotationQueueName } from '@vemetric/queues/queue-names';
import { Queue, Worker } from 'bullmq';
import { dbSalt } from 'database';
import { workerName } from '../utils/env';
import { logger } from '../utils/logger';
import { queueTelemetry } from '../utils/telemetry';

// The hub only knows the current and the previous salt, so a second salt on the same day would
// drop yesterday's salt and break user continuity across midnight.
const MIN_SALT_AGE_MS = 12 * 60 * 60 * 1000;

export async function initSaltRotation() {
  const saltRotationQueue = new Queue(saltRotationQueueName, {
    connection: {
      url: process.env.REDIS_URL,
    },
  });

  await saltRotationQueue.setGlobalConcurrency(1);
  await saltRotationQueue.upsertJobScheduler(
    saltRotationQueue.name,
    {
      pattern: '0 0 0 * * *', // every day at midnight
    },
    {
      name: 'saltRotation',
      opts: {
        backoff: 3,
        attempts: 5,
        removeOnFail: 1000,
      },
    },
  );

  return new Worker(
    saltRotationQueue.name,
    async () => {
      // Retries and stalled reruns must not create another salt once this run's salt exists.
      const { currentSalt } = await dbSalt.getLatestSalts();
      if (currentSalt && Date.now() - currentSalt.createdAt.getTime() < MIN_SALT_AGE_MS) {
        logger.info({ saltCreatedAt: currentSalt.createdAt }, 'skipped salt creation, current salt is recent');
      } else {
        await dbSalt.createSalt();
        logger.info('created new salt');
      }

      await dbSalt.cleanupOldSalts();
      logger.info('cleanup old salts');
    },
    {
      connection: {
        url: process.env.REDIS_URL,
      },
      name: workerName,
      telemetry: queueTelemetry,
      removeOnComplete: {
        count: 10,
      },
      removeOnFail: {
        count: 10000,
      },
    },
  );
}
