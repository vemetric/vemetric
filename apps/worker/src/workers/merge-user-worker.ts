import type { MergeUserQueueProps } from '@vemetric/queues/merge-user-queue';
import { mergeUserQueue } from '@vemetric/queues/merge-user-queue';
import { mergeUserQueueName } from '@vemetric/queues/queue-names';
import { DelayedError, Worker } from 'bullmq';
import { clickhouseDevice, clickhouseEvent, clickhouseSession, clickhouseUser, getDeviceId } from 'clickhouse';
import { dbUserIdentificationMap } from 'database';
import {
  persistSessionUpdates,
  assertIngestionStateStorage,
  getBufferedSessions,
  findPendingSession,
  moveBufferedSession,
} from '../ingestion';
import { insertDeviceIfNotExists } from '../utils/device';
import { logger } from '../utils/logger';
import { reassignExistingSessionsToEvents } from '../utils/merge-user';
import { queueTelemetry } from '../utils/telemetry';

const SESSION_RECHECK_DELAY_MS = 5_000;
const MAX_SESSION_WAIT_MS = 5 * 60 * 1_000;

export async function initMergeUserWorker() {
  await assertIngestionStateStorage();
  // Serialize rare identity changes; device/session ingestion remains concurrent.
  await mergeUserQueue.setGlobalConcurrency(1);
  return new Worker<MergeUserQueueProps>(
    mergeUserQueueName,
    async (job, token) => {
      const { projectId: _projectId, oldUserId: _oldUserId, newUserId: _newUserId, displayName } = job.data;
      const projectId = BigInt(_projectId);
      const oldUserId = BigInt(_oldUserId);
      const newUserId = BigInt(_newUserId);

      const existingUser = await dbUserIdentificationMap.findByUserId(String(projectId), String(newUserId));
      if (!existingUser) {
        throw new Error(`User not found: ${newUserId}`);
      }
      const existingUserClickhouse = await clickhouseUser.findById(projectId, newUserId);

      if (oldUserId === newUserId) return;

      const existingEvents = await clickhouseEvent.findByUserId(projectId, oldUserId);
      const oldUserSessions = await getBufferedSessions(
        projectId,
        oldUserId,
        await clickhouseSession.findByUserId(projectId, oldUserId),
      );
      const { sessionsWithTimeUpdates, sessionIdMapping } = await reassignExistingSessionsToEvents({
        projectId,
        newUserId,
        existingEvents,
      });

      // The previous merge path moved only sessions that actually existed. Events can
      // legitimately have a session ID with no surviving session, so do not create a
      // required session from every event ID.
      const sourceSessionIds = new Set(oldUserSessions.map((session) => session.id).filter(Boolean));
      // A cached empty/partial state may mean initialization has started. Give it
      // time to complete before taking the session snapshot again on the next attempt.
      const pendingSessionId = await findPendingSession(
        projectId,
        [...existingEvents.map((event) => event.sessionId), ...Array.from(sessionIdMapping.values())].filter(Boolean),
      );
      if (pendingSessionId !== undefined) {
        const now = Date.now();
        const startedAt = job.data.sessionWaitStartedAt ?? now;
        if (now - startedAt < MAX_SESSION_WAIT_MS) {
          if (job.data.sessionWaitStartedAt === undefined) {
            await job.updateData({ ...job.data, sessionWaitStartedAt: startedAt });
          }
          await job.moveToDelayed(Math.min(now + SESSION_RECHECK_DELAY_MS, startedAt + MAX_SESSION_WAIT_MS), token);
          throw new DelayedError();
        }
        // A page-leave-only placeholder may never initialize. Continue with the
        // events and the sessions that exist
        logger.warn({ projectId: _projectId, sessionId: pendingSessionId }, 'Session did not initialize before merge');
      }

      logger.info(
        { projectId: _projectId, oldUserId: _oldUserId, newUserId: _newUserId },
        'found existing user, merging events and devices',
      );

      const existingDevices = await clickhouseDevice.findByUserId(projectId, oldUserId);
      try {
        if (existingDevices.length > 0) {
          await clickhouseDevice.delete(existingDevices);
        }
      } catch (err) {
        logger.error({ err }, 'Error deleting devices');
      }

      for (const sourceId of Array.from(sourceSessionIds)) {
        await moveBufferedSession(
          projectId,
          sourceId,
          sessionIdMapping.get(sourceId) ?? sourceId,
          newUserId,
          existingUser.identifier,
          displayName ?? existingUserClickhouse?.displayName,
        );
      }
      // Stable session keys allow earlier start times without deleting the previous row.
      if (sessionsWithTimeUpdates.length) await persistSessionUpdates(sessionsWithTimeUpdates);

      if (!existingEvents.length) return;

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
      telemetry: queueTelemetry,
      concurrency: 10,
      removeOnComplete: {
        count: 1000,
      },
    },
  );
}
