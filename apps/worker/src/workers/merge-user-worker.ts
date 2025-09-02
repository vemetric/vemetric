import { formatClickhouseDate } from '@vemetric/common/date';
import { SESSION_DURATION_MINUTES } from '@vemetric/common/session';
import type { MergeUserQueueProps } from '@vemetric/queues/merge-user-queue';
import { mergeUserQueueName } from '@vemetric/queues/queue-names';
import { Worker } from 'bullmq';
import type { ClickhouseSession } from 'clickhouse';
import { clickhouseDevice, clickhouseEvent, clickhouseSession, clickhouseUser, getDeviceId } from 'clickhouse';
import { dbUserIdentificationMap } from 'database';
import { insertDeviceIfNotExists } from '../utils/device';
import { logger } from '../utils/logger';

const SESSION_DURATION_MS = SESSION_DURATION_MINUTES * 60 * 1000;

// Helper function to check if an event time falls within a session (with 30-minute window)
const eventBelongsToSession = (eventTime: string, session: ClickhouseSession) => {
  const eventDate = new Date(eventTime).getTime();
  const sessionStart = new Date(session.startedAt).getTime();
  const sessionEnd = new Date(session.endedAt).getTime();
  // Add 30 minutes buffer for session inactivity timeout
  const sessionStartWithBuffer = sessionStart - SESSION_DURATION_MS;
  const sessionEndWithBuffer = sessionEnd + SESSION_DURATION_MS;
  return eventDate >= sessionStartWithBuffer && eventDate <= sessionEndWithBuffer;
};

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

      // Get all sessions and events from the old user
      const oldUserSessions = await clickhouseSession.findByUserId(projectId, oldUserId);
      const existingEvents = await clickhouseEvent.findByUserId(projectId, oldUserId);

      if (existingEvents.length > 0) {
        const eventTimes = existingEvents.map((e) => new Date(e.createdAt).getTime());
        const minEventTime = Math.min(...eventTimes);
        const maxEventTime = Math.max(...eventTimes);

        const searchStartTime = new Date(minEventTime - SESSION_DURATION_MS);
        const searchEndTime = new Date(maxEventTime + SESSION_DURATION_MS);

        // Query only relevant sessions from the new user within this time range
        const newUserSessions = await clickhouseSession.findByUserIdInTimeRange(
          projectId,
          newUserId,
          searchStartTime,
          searchEndTime,
        );

        // Create a map of sessions to migrate and session ID mappings
        const oldSessionIdsToMigrate = new Set<string>();
        const sessionIdMapping = new Map<string, string>(); // old session id -> new session id
        const sessionTimeUpdates = new Map<string, { startedAt: Date; endedAt: Date; duration: number }>(); // track time updates for existing sessions

        // we iterate through all the events and see if we can find a new session to assign it to
        for (const event of existingEvents) {
          for (const newSession of newUserSessions) {
            if (!eventBelongsToSession(event.createdAt, newSession)) {
              continue;
            }

            sessionIdMapping.set(event.sessionId, newSession.id);

            // Update the session time bounds if needed
            const eventTime = new Date(event.createdAt).getTime();
            const existing = sessionTimeUpdates.get(newSession.id);

            if (existing) {
              const currentStart = existing.startedAt.getTime();
              const currentEnd = existing.endedAt.getTime();
              const newStart = Math.min(currentStart, eventTime);
              const newEnd = Math.max(currentEnd, eventTime);

              sessionTimeUpdates.set(newSession.id, {
                startedAt: new Date(newStart),
                endedAt: new Date(newEnd),
                duration: Math.round((newEnd - newStart) / 1000),
              });
            } else {
              const currentStart = new Date(newSession.startedAt).getTime();
              const currentEnd = new Date(newSession.endedAt).getTime();
              const newStart = Math.min(currentStart, eventTime);
              const newEnd = Math.max(currentEnd, eventTime);

              if (newStart < currentStart || newEnd > currentEnd) {
                sessionTimeUpdates.set(newSession.id, {
                  startedAt: new Date(newStart),
                  endedAt: new Date(newEnd),
                  duration: Math.round((newEnd - newStart) / 1000),
                });
              }
            }
            break;
          }

          // no new session found, we just keep the old session
          oldSessionIdsToMigrate.add(event.sessionId);
        }

        // Update the new users' sessions where the times have changed
        if (sessionTimeUpdates.size > 0) {
          const sessionsToUpdate: Array<ClickhouseSession> = [];
          sessionTimeUpdates.forEach((timeUpdate, sessionId) => {
            const session = newUserSessions.find((s) => s.id === sessionId);
            if (session) {
              sessionsToUpdate.push({
                ...session,
                duration: timeUpdate.duration,
                startedAt: formatClickhouseDate(timeUpdate.startedAt),
                endedAt: formatClickhouseDate(timeUpdate.endedAt),
              });
            }
          });
          if (sessionsToUpdate.length > 0) {
            await clickhouseSession.insert(sessionsToUpdate);
          }
        }

        // Migrate old sessions that still have events
        const oldSessionsToMigrate = Array.from(oldSessionIdsToMigrate)
          .map((sessionId) => {
            const session = oldUserSessions.find((s) => s.id === sessionId);
            return session;
          })
          .filter((session) => session !== undefined);
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

        // Delete all old sessions
        if (oldUserSessions.length > 0) {
          await clickhouseSession.delete(oldUserSessions.map((session) => ({ ...session, id: '' })));
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

        // Update all events with proper session assignment
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
