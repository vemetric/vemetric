import { sessionFlushQueueName } from '@vemetric/queues/queue-names';
import { defaultQueueConnection } from '@vemetric/queues/queue-utils';
import { sessionFlushQueue } from '@vemetric/queues/session-flush-queue';
import { Worker } from 'bullmq';
import { flushSessionBuffer, flushUserBuffer } from '../ingestion';
import { envPositiveInteger, workerName } from '../utils/env';
import { queueTelemetry } from '../utils/telemetry';

// ClickHouse favors few large inserts, so a single flusher writes big batches instead of
// adding parallel writers. Ten full batches per 1s tick bound a tick's work.
const batchSize = envPositiveInteger('SESSION_FLUSH_BATCH_SIZE', 5000);

export async function initSessionFlushWorker() {
  await sessionFlushQueue.setGlobalConcurrency(1);
  await sessionFlushQueue.upsertJobScheduler(
    sessionFlushQueueName,
    { every: 1000 },
    {
      name: sessionFlushQueueName,
      opts: { attempts: 5, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: 10, removeOnFail: 100 },
    },
  );
  return new Worker(
    sessionFlushQueueName,
    async () => {
      const errors: unknown[] = [];
      // Dirty keys are never removed before a successful write.
      try {
        for (let batch = 0; batch < 10; batch++) {
          if ((await flushSessionBuffer(batchSize)) < batchSize) break;
        }
      } catch (err) {
        errors.push(err);
      }
      // User rows too: the user table keeps the last inserted row, so they need this single
      // writer to be written in order.
      try {
        for (let batch = 0; batch < 10; batch++) {
          if ((await flushUserBuffer(batchSize)) < batchSize) break;
        }
      } catch (err) {
        errors.push(err);
      }
      if (errors.length === 1) throw errors[0];
      if (errors.length > 1) throw new AggregateError(errors, 'Session and user flushes failed');
    },
    { connection: defaultQueueConnection, name: workerName, concurrency: 1, telemetry: queueTelemetry },
  );
}
