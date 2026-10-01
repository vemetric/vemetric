import type { ConnectionOptions, JobsOptions } from 'bullmq';
import { Queue } from 'bullmq';
import { prismaClient } from 'database';
import Redis from 'ioredis';
import { logger } from './logger';

export const defaultQueueConnection: ConnectionOptions = {
  url: process.env.REDIS_URL,
  enableOfflineQueue: false,
  retryStrategy: (times) => {
    return Math.min(times * 100, 2000);
  },
};

const defaultQueueOptions: JobsOptions = {
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
};

const queues: Queue[] = [];
export function createQueue<DataType = any>(name: string) {
  const queue = new Queue<DataType>(name, { connection: defaultQueueConnection });
  queues.push(queue);
  return queue;
}

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { enableOfflineQueue: false });
let hasBeenOnline = false;
export async function addToQueue<DataType>(queue: Queue<DataType>, data: DataType, options?: JobsOptions) {
  try {
    if (!hasBeenOnline) {
      // this is a workaround because BullMQ doesn't support offline queues when Redis is down initially
      await redis.ping();
    }
    await queue.add(queue.name as any, data as any, {
      ...defaultQueueOptions,
      ...options,
    });
    hasBeenOnline = true;
  } catch (err) {
    logger.error({ err }, 'Error adding job');
    await prismaClient.failedQueueJob.create({
      data: {
        queueName: queue.name,
        data: JSON.stringify(data),
        error: JSON.stringify(err),
      },
    });
  }
}

/**
 * Closes the connections of every queue created in this process. Pending `add` calls finish
 * first, so call it once no new jobs can be enqueued (e.g. after the HTTP server stopped).
 */
export async function closeQueues() {
  await Promise.all(queues.map((queue) => queue.close()));
  try {
    await redis.quit();
  } catch {
    // The connection may never have been established or is already closed.
    redis.disconnect();
  }
}
