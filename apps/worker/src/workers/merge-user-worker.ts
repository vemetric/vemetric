import type { MergeUserQueueProps } from '@vemetric/queues/merge-user-queue';
import { mergeUserQueueName } from '@vemetric/queues/queue-names';
import { Worker } from 'bullmq';
import { clickhouseDevice, clickhouseEvent, clickhouseSession, clickhouseUser, getDeviceId } from 'clickhouse';
import { dbUserIdentificationMap } from 'database';
import { insertDeviceIfNotExists } from '../utils/device';
import { logger } from '../utils/logger';

export async function initMergeUserWorker() {
  return new Worker<MergeUserQueueProps>(
    mergeUserQueueName,
    async (job) => {
      const { projectId: _projectId, oldUserId: _oldUserId, newUserId: _newUserId, displayName } = job.data;
      const projectId = BigInt(_projectId);
      const oldUserId = BigInt(_oldUserId);
      const newUserId = BigInt(_newUserId);

      // we found an existing user with the same identifier, so we merge the events and devices into it
      logger.info({ projectId: String(projectId) }, 'found existing user, merging events and devices');
      const existingUser = await dbUserIdentificationMap.findByUserId(String(projectId), String(newUserId));
      if (!existingUser) {
        throw new Error(`User not found: ${newUserId}`);
      }
      const existingUserClickhouse = await clickhouseUser.findById(projectId, newUserId);

      const existingDevices = await clickhouseDevice.findByUserId(projectId, oldUserId);
      try {
        if (existingDevices.length > 0) {
          await clickhouseDevice.delete(existingDevices);
        }
      } catch (err) {
        logger.error({ err }, 'Error deleting devices');
      }

      // update all sessions to the new user id, and delete the old ones
      const existingSessions = await clickhouseSession.findByUserId(projectId, oldUserId);
      if (existingSessions.length > 0) {
        await clickhouseSession.insert(
          existingSessions.map((session) => ({
            ...session,
            userId: newUserId,
            userIdentifier: existingUser.identifier,
            userDisplayName: displayName ?? existingUserClickhouse?.displayName,
          })),
        );
        await clickhouseSession.delete(existingSessions.map((session) => ({ ...session, id: '' })));
      }

      // update all events to the new user id, and delete the old ones, also insert the corresponding devices for the new user if they don't exist yet
      const existingEvents = await clickhouseEvent.findByUserId(projectId, oldUserId);
      if (existingEvents.length > 0) {
        await clickhouseEvent.delete(existingEvents.map((event) => ({ ...event, sessionId: '' })));

        const insertedDeviceIds: bigint[] = [];
        for (const event of existingEvents) {
          const deviceId = getDeviceId(projectId, newUserId, event);
          if (!insertedDeviceIds.includes(deviceId)) {
            await insertDeviceIfNotExists(projectId, newUserId, deviceId, event);
            insertedDeviceIds.push(deviceId);
          }
        }

        await clickhouseEvent.insert(
          existingEvents.map((event) => {
            const deviceId = getDeviceId(projectId, newUserId, event);

            return {
              ...event,
              projectId,
              userId: newUserId,
              deviceId,
              userDisplayName: displayName ?? existingUserClickhouse?.displayName,
              userIdentifier: existingUser.identifier,
            };
          }),
        );
      }
    },
    {
      connection: {
        url: process.env.REDIS_URL,
      },
      concurrency: 10,
      removeOnComplete: {
        count: 1000,
      },
    },
  );
}
