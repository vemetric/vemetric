import { updateUserQueueName } from '@vemetric/queues/queue-names';
import type { UpdateUserQueueProps } from '@vemetric/queues/update-user-queue';
import { Worker } from 'bullmq';
import { clickhouseUser } from 'clickhouse';
import { isDeepEqual } from 'remeda';
import { logJobStep } from '../utils/job-logger';
import { getUpdatedUserData } from '../utils/user';

export async function initUpdateUserWorker() {
  return new Worker<UpdateUserQueueProps>(
    updateUserQueueName,
    async (job) => {
      const { projectId: _projectId, userId: _userId, updatedAt, displayName, avatarUrl, data } = job.data;
      const projectId = BigInt(_projectId);
      const userId = BigInt(_userId);

      await logJobStep(job, `start project=${projectId} user=${userId}`);
      await logJobStep(job, 'before clickhouseUser.findById');
      const user = await clickhouseUser.findById(projectId, userId);
      await logJobStep(job, user ? 'after clickhouseUser.findById found' : 'after clickhouseUser.findById missing');
      if (!user) {
        await logJobStep(job, 'done missing user');
        return;
      }
      const updatedUserData = getUpdatedUserData(user.customData as object, data ?? {});

      let hasChanged = false;
      if (displayName && displayName !== user.displayName) {
        hasChanged = true;
      } else if (typeof avatarUrl === 'string' && avatarUrl !== user.avatarUrl) {
        hasChanged = true;
      } else if (data && !isDeepEqual(user.customData, updatedUserData)) {
        hasChanged = true;
      }

      if (!hasChanged) {
        await logJobStep(job, 'done no changes');
        return;
      }

      const updatedUser = { ...user, customData: updatedUserData, updatedAt };
      if (displayName) {
        updatedUser.displayName = displayName;
      }
      if (typeof avatarUrl === 'string') {
        updatedUser.avatarUrl = avatarUrl;
      }
      await logJobStep(job, 'before clickhouseUser.insert');
      await clickhouseUser.insert([updatedUser]);
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
