import { updateUserQueueName } from '@vemetric/queues/queue-names';
import type { UpdateUserQueueProps } from '@vemetric/queues/update-user-queue';
import { Worker } from 'bullmq';
import { clickhouseUser } from 'clickhouse';
import { isDeepEqual } from 'remeda';
import { getUpdatedUserData } from '../utils/user';

export async function initUpdateUserWorker() {
  return new Worker<UpdateUserQueueProps>(
    updateUserQueueName,
    async (job) => {
      const { projectId: _projectId, userId: _userId, updatedAt, displayName, data } = job.data;
      const projectId = BigInt(_projectId);
      const userId = BigInt(_userId);

      const user = await clickhouseUser.findById(projectId, userId);
      if (!user) {
        return;
      }
      const updatedUserData = getUpdatedUserData(user.customData as object, data ?? {});

      let hasChanged = false;
      if (displayName && displayName !== user.displayName) {
        hasChanged = true;
      } else if (data && !isDeepEqual(user.customData, updatedUserData)) {
        hasChanged = true;
      }

      if (!hasChanged) {
        return;
      }

      const updatedUser = { ...user, customData: updatedUserData, updatedAt };
      if (displayName) {
        updatedUser.displayName = displayName;
      }
      await clickhouseUser.insert([updatedUser]);
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
