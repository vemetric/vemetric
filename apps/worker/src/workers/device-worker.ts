import type { CreateDeviceQueueProps } from '@vemetric/queues/create-device-queue';
import { createDeviceQueueName } from '@vemetric/queues/queue-names';
import { Worker } from 'bullmq';
import { getDeviceId } from 'clickhouse';
import { getDeviceDataFromHeaders, insertDeviceIfNotExists } from '../utils/device';

export async function initDeviceWorker() {
  return new Worker<CreateDeviceQueueProps>(
    createDeviceQueueName,
    async (job) => {
      const { projectId: _projectId, userId: _userId, headers } = job.data;
      const projectId = BigInt(_projectId);
      const userId = BigInt(_userId);

      const deviceData = await getDeviceDataFromHeaders(headers);
      const deviceId = getDeviceId(projectId, userId, deviceData);

      await insertDeviceIfNotExists(projectId, userId, deviceId, deviceData);
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
