import { EMPTY_GEO_DATA, getGeoDataFromIp } from '@vemetric/common/geo';
import { createUserQueue, type CreateUserQueueProps } from '@vemetric/queues/create-user-queue';
import { createUserQueueName } from '@vemetric/queues/queue-names';
import { Worker } from 'bullmq';
import { clickhouseEvent } from 'clickhouse';
import { getUser, upsertUser } from '../ingestion';
import { envPositiveInteger, workerName } from '../utils/env';
import { logJobStep } from '../utils/job-logger';
import { logger } from '../utils/logger';
import { queueTelemetry } from '../utils/telemetry';
import { getUserFirstPageViewData } from '../utils/user';

export async function initCreateUserWorker() {
  // User writes are compare-and-set operations on the user's state, so jobs run concurrently.
  await createUserQueue.removeGlobalConcurrency();
  return new Worker<CreateUserQueueProps>(
    createUserQueueName,
    async (job) => {
      const {
        projectId: _projectId,
        userId: _userId,
        createdAt,
        identifier,
        displayName,
        ipAddress,
        geoData,
        avatarUrl,
        data,
      } = job.data;
      const projectId = BigInt(_projectId);
      const userId = BigInt(_userId);

      await logJobStep(job, `start project=${projectId} user=${userId}`);
      // Location and first page view only matter for a new user; an existing one just takes the data.
      const exists = (await getUser(projectId, userId)) !== null;
      await logJobStep(job, exists ? 'existing user' : 'new user');
      const resolved = exists
        ? {}
        : {
            geo: geoData || (ipAddress ? await getGeoDataFromIp(ipAddress, logger, 5000) : EMPTY_GEO_DATA),
            firstPageView: getUserFirstPageViewData(await clickhouseEvent.getFirstPageViewByUserId(projectId, userId)),
          };
      await upsertUser(projectId, userId, {
        type: 'create',
        create: { createdAt, identifier, displayName, avatarUrl: avatarUrl || '', data, ...resolved },
      });
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
