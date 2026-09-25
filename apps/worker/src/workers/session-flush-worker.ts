import { sessionFlushQueueName } from '@vemetric/queues/queue-names';
import { defaultQueueConnection } from '@vemetric/queues/queue-utils';
import { Queue, Worker } from 'bullmq';
import { assertIngestionStateStorage, flushSessionBuffer, positiveStateInteger } from '../ingestion';
import { queueTelemetry } from '../utils/telemetry';

// ClickHouse favors few large inserts, so a single flusher writes big batches instead of
// adding parallel writers. Ten full batches per 1s tick bound a tick's work.
const batchSize = positiveStateInteger('SESSION_FLUSH_BATCH_SIZE', 5000);

export async function initSessionFlushWorker() {
  await assertIngestionStateStorage();
  const queue = new Queue(sessionFlushQueueName, { connection: defaultQueueConnection, telemetry: queueTelemetry });
  try {
    await queue.setGlobalConcurrency(1);
    await queue.upsertJobScheduler(
      sessionFlushQueueName,
      { every: 1000 },
      {
        name: sessionFlushQueueName,
        opts: { attempts: 5, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: 10, removeOnFail: 100 },
      },
    );
  } finally {
    await queue.close();
  }
  return new Worker(
    sessionFlushQueueName,
    async () => {
      // Dirty keys are never removed before a successful write.
      for (let batch = 0; batch < 10; batch++) {
        if ((await flushSessionBuffer(batchSize)) < batchSize) break;
      }
    },
    { connection: defaultQueueConnection, concurrency: 1, telemetry: queueTelemetry },
  );
}
