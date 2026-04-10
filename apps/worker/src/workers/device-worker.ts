import type { CreateDeviceQueueProps } from '@vemetric/queues/create-device-queue';
import { createDeviceQueueName } from '@vemetric/queues/queue-names';
import { Worker } from 'bullmq';
import { getDeviceId } from 'clickhouse';
import { getDeviceDataFromHeaders, insertDeviceIfNotExists } from '../utils/device';
import { logJobStep } from '../utils/job-logger';

export async function initDeviceWorker() {
  return new Worker<CreateDeviceQueueProps>(
    createDeviceQueueName,
    async (job) => {
      const { projectId: _projectId, userId: _userId, headers } = job.data;
      const projectId = BigInt(_projectId);
      const userId = BigInt(_userId);

      await logJobStep(job, `start project=${projectId} user=${userId}`);
      await logJobStep(job, 'before getDeviceDataFromHeaders');
      const deviceData = await getDeviceDataFromHeaders(headers);
      await logJobStep(job, 'after getDeviceDataFromHeaders');
      const deviceId = getDeviceId(projectId, userId, deviceData);

      await logJobStep(job, `before insertDeviceIfNotExists device=${deviceId}`);
      await insertDeviceIfNotExists(projectId, userId, deviceId, deviceData);
      await logJobStep(job, 'done');
    },
    {
      connection: {
        url: process.env.REDIS_URL,
      },
      concurrency: 1,
      removeOnComplete: {
        count: 1000,
      },
    },
  );
}
