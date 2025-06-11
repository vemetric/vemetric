import { Queue, Worker } from 'bullmq';
import { dbSalt } from 'database';
import { logger } from '../utils/logger';

export async function initSaltRotation() {
  const saltRotationQueue = new Queue('saltRotation', {
    connection: {
      url: process.env.REDIS_URL,
    },
  });

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
      await dbSalt.createSalt();
      logger.info('created new salt');

      await dbSalt.cleanupOldSalts();
      logger.info('cleanup old salts');
    },
    {
      connection: {
        url: process.env.REDIS_URL,
      },
      removeOnComplete: {
        count: 10,
      },
      removeOnFail: {
        count: 10000,
      },
    },
  );
}
