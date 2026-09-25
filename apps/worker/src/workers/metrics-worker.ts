import {
  createDeviceQueueName,
  createUserQueueName,
  emailDripQueueName,
  enrichUserQueueName,
  eventQueueName,
  firstEventQueueName,
  mergeUserQueueName,
  metricsQueueName,
  saltRotationQueueName,
  sessionFlushQueueName,
  sessionQueueName,
  updateUserQueueName,
} from '@vemetric/queues/queue-names';
import { defaultQueueConnection } from '@vemetric/queues/queue-utils';
import { Queue, Worker } from 'bullmq';
import { METRICS_INTERVAL_MS, recordQueueJobCounts } from '../utils/telemetry';

const recordedQueueNames = [
  createDeviceQueueName,
  createUserQueueName,
  emailDripQueueName,
  enrichUserQueueName,
  eventQueueName,
  firstEventQueueName,
  mergeUserQueueName,
  saltRotationQueueName,
  sessionFlushQueueName,
  sessionQueueName,
  updateUserQueueName,
];

export async function initMetricsWorker() {
  const queue = new Queue(metricsQueueName, { connection: defaultQueueConnection });
  try {
    // A single job scheduler plus global concurrency 1 means exactly one replica records
    // queue counts per interval, without any per-instance configuration.
    await queue.setGlobalConcurrency(1);
    await queue.upsertJobScheduler(
      metricsQueueName,
      { every: METRICS_INTERVAL_MS },
      {
        name: metricsQueueName,
        opts: { removeOnComplete: 1, removeOnFail: 10 },
      },
    );
  } finally {
    await queue.close();
  }

  // Deliberately no telemetry: the metrics queue must not report its own jobs.
  return new Worker(metricsQueueName, () => recordQueueJobCounts(recordedQueueNames), {
    connection: defaultQueueConnection,
    concurrency: 1,
  });
}
