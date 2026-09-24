import type { CreateDeviceQueueProps } from '@vemetric/queues/create-device-queue';
import { createDeviceQueue } from '@vemetric/queues/create-device-queue';
import { createDeviceQueueName } from '@vemetric/queues/queue-names';
import { Worker } from 'bullmq';
import { getDeviceId } from 'clickhouse';
import { assertIngestionStateStorage } from '../ingestion';
import { workerConcurrency } from '../utils/concurrency';
import { getDeviceDataFromHeaders, insertDeviceIfNotExists } from '../utils/device';
import { logJobStep } from '../utils/job-logger';
import { queueTelemetry } from '../utils/telemetry';

export async function initDeviceWorker() {
  await assertIngestionStateStorage();
  await createDeviceQueue.removeGlobalConcurrency();
  return new Worker<CreateDeviceQueueProps>(
    createDeviceQueueName,
    async (job) => {
      const { projectId: _projectId, userId: _userId, headers } = job.data;

      const projectId = BigInt(_projectId);
      const userId = BigInt(_userId);

      await logJobStep(job, 'device start', { jobId: job.id, projectId, userId });
      await logJobStep(job, 'device before getDeviceDataFromHeaders', { projectId, userId });
      const deviceData = await getDeviceDataFromHeaders(headers);
      await logJobStep(job, 'device after getDeviceDataFromHeaders', {
        projectId,
        userId,
        osName: deviceData.osName,
        osVersion: deviceData.osVersion,
        clientName: deviceData.clientName,
        clientVersion: deviceData.clientVersion,
        clientType: deviceData.clientType,
        deviceType: deviceData.deviceType,
      });
      const deviceId = getDeviceId(projectId, userId, deviceData);

      await logJobStep(job, 'device before insertDeviceIfNotExists', { projectId, userId, deviceId });
      await insertDeviceIfNotExists(projectId, userId, deviceId, deviceData, job);
      await logJobStep(job, 'device done', { projectId, userId, deviceId });
    },
    {
      connection: {
        url: process.env.REDIS_URL,
      },
      telemetry: queueTelemetry,
      concurrency: workerConcurrency('DEVICE_WORKER_CONCURRENCY', 20),
      removeOnComplete: {
        count: 1000,
      },
    },
  );
}
