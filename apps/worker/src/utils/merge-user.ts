import { formatClickhouseDate } from '@vemetric/common/date';
import { SESSION_DURATION_MINUTES } from '@vemetric/common/session';
import type { ClickhouseEvent, ClickhouseSession } from 'clickhouse';
import { clickhouseDateToISO, clickhouseSession } from 'clickhouse';

const SESSION_DURATION_MS = SESSION_DURATION_MINUTES * 60 * 1000;

// Helper function to check if an event time falls within a session (with 30-minute window)
const eventBelongsToSession = (eventTime: string, session: ClickhouseSession) => {
  const eventDate = new Date(clickhouseDateToISO(eventTime)).getTime();
  const sessionStart = new Date(clickhouseDateToISO(session.startedAt)).getTime();
  const sessionEnd = new Date(clickhouseDateToISO(session.endedAt)).getTime();
  // Add 30 minutes buffer for session inactivity timeout
  const sessionStartWithBuffer = sessionStart - SESSION_DURATION_MS;
  const sessionEndWithBuffer = sessionEnd + SESSION_DURATION_MS;
  return eventDate >= sessionStartWithBuffer && eventDate <= sessionEndWithBuffer;
};

interface UserMigrationContext {
  projectId: bigint;
  newUserId: bigint;
  existingEvents: Array<ClickhouseEvent>;
  oldUserSessions: Array<ClickhouseSession>;
}

export const reassignExistingSessionsToEvents = async (context: UserMigrationContext) => {
  const { projectId, newUserId, existingEvents, oldUserSessions } = context;

  const eventTimes = existingEvents.map((e) => new Date(clickhouseDateToISO(e.createdAt)).getTime());
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
  const sessionTimeUpdates = new Map<
    string,
    { changedStart: boolean; startedAt: Date; endedAt: Date; duration: number }
  >(); // track time updates for existing sessions

  // we iterate through all the events and see if we can find a new session to assign it to
  for (const event of existingEvents) {
    for (const newSession of newUserSessions) {
      if (!eventBelongsToSession(event.createdAt, newSession)) {
        continue;
      }

      sessionIdMapping.set(event.sessionId, newSession.id);

      // Update the session time bounds if needed
      const eventTime = new Date(clickhouseDateToISO(event.createdAt)).getTime();
      const existing = sessionTimeUpdates.get(newSession.id);

      if (existing) {
        const currentStart = existing.startedAt.getTime();
        const currentEnd = existing.endedAt.getTime();
        const newStart = Math.min(currentStart, eventTime);
        const newEnd = Math.max(currentEnd, eventTime);

        sessionTimeUpdates.set(newSession.id, {
          changedStart: existing.changedStart || newStart !== currentStart,
          startedAt: new Date(newStart),
          endedAt: new Date(newEnd),
          duration: Math.round((newEnd - newStart) / 1000),
        });
      } else {
        const currentStart = new Date(clickhouseDateToISO(newSession.startedAt)).getTime();
        const currentEnd = new Date(clickhouseDateToISO(newSession.endedAt)).getTime();
        const newStart = Math.min(currentStart, eventTime);
        const newEnd = Math.max(currentEnd, eventTime);

        if (newStart < currentStart || newEnd > currentEnd) {
          sessionTimeUpdates.set(newSession.id, {
            changedStart: newStart !== currentStart,
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

  const oldSessionsToMigrate = Array.from(oldSessionIdsToMigrate)
    .map((sessionId) => {
      const session = oldUserSessions.find((s) => s.id === sessionId);
      return session;
    })
    .filter((session) => session !== undefined);

  const sessionsWithTimeUpdates: Array<ClickhouseSession> = [];
  const newUserSessionsToDelete: Array<ClickhouseSession> = [];
  // Update the new users' sessions where the times have changed
  if (sessionTimeUpdates.size > 0) {
    sessionTimeUpdates.forEach((timeUpdate, sessionId) => {
      const session = newUserSessions.find((s) => s.id === sessionId);
      if (session) {
        if (timeUpdate.changedStart) {
          // the start time has changed, we delete the session because it counts as a new one
          newUserSessionsToDelete.push(session);
        }
        sessionsWithTimeUpdates.push({
          ...session,
          duration: timeUpdate.duration,
          startedAt: formatClickhouseDate(timeUpdate.startedAt),
          endedAt: formatClickhouseDate(timeUpdate.endedAt),
        });
      }
    });
  }

  return { sessionsWithTimeUpdates, newUserSessionsToDelete, oldSessionsToMigrate, sessionIdMapping };
};
