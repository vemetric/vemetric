import { EMPTY_GEO_DATA, getGeoDataFromIp } from '@vemetric/common/geo';
import type { CreateUserQueueProps } from '@vemetric/queues/create-user-queue';
import { createUserQueueName } from '@vemetric/queues/queue-names';
import { addToQueue } from '@vemetric/queues/queue-utils';
import { updateUserQueue } from '@vemetric/queues/update-user-queue';
import { Worker } from 'bullmq';
import type { ClickhouseUser } from 'clickhouse';
import { clickhouseEvent, clickhouseUser } from 'clickhouse';
import { logJobStep } from '../utils/job-logger';
import { logger } from '../utils/logger';
import { getUserFirstPageViewData } from '../utils/user';

export async function initCreateUserWorker() {
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
      await logJobStep(job, 'before clickhouseUser.findById');
      const existingUser = await clickhouseUser.findById(projectId, userId);
      await logJobStep(
        job,
        existingUser ? 'after clickhouseUser.findById existing' : 'after clickhouseUser.findById missing',
      );
      if (existingUser) {
        // if the user already exists, we update the user with the new data
        await logJobStep(job, 'before enqueue updateUser');
        await addToQueue(updateUserQueue, {
          projectId: String(projectId),
          userId: String(userId),
          updatedAt: createdAt,
          data: {
            set: data,
          },
        });
        await logJobStep(job, 'done existing user enqueued update');
        return;
      }

      await logJobStep(job, 'before clickhouseEvent.getFirstPageViewByUserId');
      const firstPageView = await clickhouseEvent.getFirstPageViewByUserId(projectId, userId!);
      await logJobStep(job, 'after clickhouseEvent.getFirstPageViewByUserId');
      const user: ClickhouseUser = {
        projectId,
        id: userId,
        identifier,
        displayName,
        avatarUrl: avatarUrl || '',
        createdAt,
        firstSeenAt: createdAt,
        updatedAt: createdAt,
        customData: data,
        ...(geoData || (ipAddress ? await getGeoDataFromIp(ipAddress, logger, 5000) : EMPTY_GEO_DATA)),
        ...getUserFirstPageViewData(firstPageView),
      };
      await logJobStep(job, 'before clickhouseUser.insert');
      await clickhouseUser.insert([user]);
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
