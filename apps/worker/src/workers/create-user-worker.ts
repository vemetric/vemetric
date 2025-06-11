import type { CreateUserQueueProps } from '@vemetric/queues/create-user-queue';
import { createUserQueueName } from '@vemetric/queues/queue-names';
import { addToQueue } from '@vemetric/queues/queue-utils';
import { updateUserQueue } from '@vemetric/queues/update-user-queue';
import { Worker } from 'bullmq';
import type { ClickhouseUser } from 'clickhouse';
import { clickhouseEvent, clickhouseUser } from 'clickhouse';
import { getGeoData } from '../utils/geo';

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
      const initialPageView = await clickhouseEvent.getFirstPageViewByUserId(projectId, userId!);
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
        ...(initialPageView
          ? {
              firstSeenAt: initialPageView.createdAt,
              countryCode: initialPageView.countryCode,
              city: initialPageView.city,
              initialDeviceId: initialPageView.deviceId,
              userAgent: initialPageView.userAgent,
              referrer: initialPageView.referrer,
              referrerUrl: initialPageView.referrerUrl,
              referrerType: initialPageView.referrerType,

              origin: initialPageView.origin,
              pathname: initialPageView.pathname,
              urlHash: initialPageView.urlHash,
              queryParams: initialPageView.queryParams,

              utmSource: initialPageView.utmSource,
              utmMedium: initialPageView.utmMedium,
              utmCampaign: initialPageView.utmCampaign,
              utmContent: initialPageView.utmContent,
              utmTerm: initialPageView.utmTerm,
            }
          : {}),
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
