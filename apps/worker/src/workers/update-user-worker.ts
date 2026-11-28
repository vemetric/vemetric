import { updateUserQueueName } from '@vemetric/queues/queue-names';
import { updateUserQueue, type UpdateUserQueueProps } from '@vemetric/queues/update-user-queue';
import { Worker } from 'bullmq';
import { upsertUser } from '../ingestion';
import { envPositiveInteger, workerName } from '../utils/env';
import { logJobStep } from '../utils/job-logger';
import { queueTelemetry } from '../utils/telemetry';

export async function initUpdateUserWorker() {
  // See initCreateUserWorker: user writes no longer need to run one at a time.
  await updateUserQueue.removeGlobalConcurrency();
  return new Worker<UpdateUserQueueProps>(
    updateUserQueueName,
    async (job) => {
      const { projectId: _projectId, userId: _userId, updatedAt, displayName, avatarUrl, data } = job.data;
      const projectId = BigInt(_projectId);
      const userId = BigInt(_userId);

      await logJobStep(job, `start project=${projectId} user=${userId}`);
      // An update for a user that does not exist yet waits in Redis for its create.
      await upsertUser(projectId, userId, { type: 'update', update: { updatedAt, displayName, avatarUrl, data } });
      await logJobStep(job, 'done');
    },
    {
      connection: {
        url: process.env.REDIS_URL,
      },
      name: workerName,
      telemetry: queueTelemetry,
      concurrency: envPositiveInteger('USER_WORKER_CONCURRENCY', 20),
      removeOnComplete: {
        count: 1000,
      },
    },
  );
}
