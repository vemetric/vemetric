import type { CreateUserQueueProps } from '@vemetric/queues/create-user-queue';
import { createUserQueueName } from '@vemetric/queues/queue-names';
import { addToQueue } from '@vemetric/queues/queue-utils';
import { updateUserQueue } from '@vemetric/queues/update-user-queue';
import { Worker } from 'bullmq';
import type { ClickhouseUser } from 'clickhouse';
import { clickhouseEvent, clickhouseUser } from 'clickhouse';
import { getGeoData } from '../utils/geo';
import { getUserFirstPageViewData } from '../utils/user';

export async function initCreateUserWorker() {
  return new Worker<CreateUserQueueProps>(
    createUserQueueName,
    async (job) => {
      const { projectId: _projectId, userId: _userId, createdAt, identifier, displayName, ipAddress, data } = job.data;
      const projectId = BigInt(_projectId);
      const userId = BigInt(_userId);

      const existingUser = await clickhouseUser.findById(projectId, userId);
      if (existingUser) {
        // if the user already exists, we update the user with the new data
        await addToQueue(updateUserQueue, {
          projectId: String(projectId),
          userId: String(userId),
          updatedAt: createdAt,
          data: {
            set: data,
          },
        });
        return;
      }

      const geoData = await getGeoData(ipAddress);
      const firstPageView = await clickhouseEvent.getFirstPageViewByUserId(projectId, userId!);
      const user: ClickhouseUser = {
        projectId,
        id: userId,
        identifier,
        displayName,
        createdAt,
        firstSeenAt: createdAt,
        updatedAt: createdAt,
        customData: data,
        ...geoData,
        ...getUserFirstPageViewData(firstPageView),
      };
      await clickhouseUser.insert([user]);
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
