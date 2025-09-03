import type { MergeUserQueueProps } from '@vemetric/queues/merge-user-queue';
import { mergeUserQueueName } from '@vemetric/queues/queue-names';
import { Worker } from 'bullmq';
import { clickhouseDevice, clickhouseEvent, clickhouseSession, clickhouseUser, getDeviceId } from 'clickhouse';
import { dbUserIdentificationMap } from 'database';
import { insertDeviceIfNotExists } from '../utils/device';
import { logger } from '../utils/logger';
import { reassignExistingSessionsToEvents } from '../utils/merge-user';

export async function initMergeUserWorker() {
  return new Worker<MergeUserQueueProps>(
    mergeUserQueueName,
    async (job) => {
      const { projectId: _projectId, oldUserId: _oldUserId, newUserId: _newUserId, displayName } = job.data;
      const projectId = BigInt(_projectId);
      const oldUserId = BigInt(_oldUserId);
      const newUserId = BigInt(_newUserId);

      // we found an existing user with the same identifier, so we merge the events and devices into it
      logger.info(
        { projectId: _projectId, oldUserId: _oldUserId, newUserId: _newUserId },
        'found existing user, merging events and devices',
      );
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

      const existingEvents = await clickhouseEvent.findByUserId(projectId, oldUserId);
      if (existingEvents.length <= 0) {
        return;
      }
      const oldUserSessions = await clickhouseSession.findByUserId(projectId, oldUserId);
      const { sessionsWithTimeUpdates, newUserSessionsToDelete, oldSessionsToMigrate, sessionIdMapping } =
        await reassignExistingSessionsToEvents({
          projectId,
          newUserId,
          existingEvents,
          oldUserSessions,
        });

      // Migrate old sessions that still have events assigned to the new user
      if (oldSessionsToMigrate.length > 0) {
        await clickhouseSession.insert(
          oldSessionsToMigrate.map((session) => {
            return {
              ...session,
              userId: newUserId,
              userIdentifier: existingUser.identifier,
              userDisplayName: displayName ?? existingUserClickhouse?.displayName,
            };
          }),
        );
      }

      // update (and insert) sessions from the new user where times have changed
      if (sessionsWithTimeUpdates.length > 0) {
        await clickhouseSession.insert(sessionsWithTimeUpdates);
      }

      // Delete all sessions from the old user and also sessions from the new user that have updated their start time (because that's part of the primary key in clickhouse)
      if (oldUserSessions.length > 0 || newUserSessionsToDelete.length > 0) {
        await clickhouseSession.delete(
          [...oldUserSessions, ...newUserSessionsToDelete].map((session) => ({ ...session, id: '' })),
        );
      }

      // Delete all old events
      await clickhouseEvent.delete(existingEvents.map((event) => ({ ...event, sessionId: '' })));

      const insertedDeviceIds: bigint[] = [];
      for (const event of existingEvents) {
        const deviceId = getDeviceId(projectId, newUserId, event);
        if (!insertedDeviceIds.includes(deviceId)) {
          await insertDeviceIfNotExists(projectId, newUserId, deviceId, event);
          insertedDeviceIds.push(deviceId);
        }
      }

      // Add all events to the new user with proper session and device assignment
      await clickhouseEvent.insert(
        existingEvents.map((event) => {
          const deviceId = getDeviceId(projectId, newUserId, event);

          return {
            ...event,
            projectId,
            userId: newUserId,
            deviceId,
            sessionId: sessionIdMapping.get(event.sessionId) ?? event.sessionId,
            userDisplayName: displayName ?? existingUserClickhouse?.displayName,
            userIdentifier: existingUser.identifier,
          };
        }),
      );
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
