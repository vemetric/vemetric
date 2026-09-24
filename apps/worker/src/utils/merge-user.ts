import { formatClickhouseDate } from '@vemetric/common/date';
import { SESSION_DURATION_MINUTES } from '@vemetric/common/session';
import type { ClickhouseEvent, ClickhouseSession } from 'clickhouse';
import { clickhouseDateToISO, clickhouseSession } from 'clickhouse';
import { getBufferedSessions } from '../ingestion';

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
}

export const reassignExistingSessionsToEvents = async (context: UserMigrationContext) => {
  const { projectId, newUserId, existingEvents } = context;

  if (!existingEvents.length)
    return {
      sessionsWithTimeUpdates: [],
      sessionIdMapping: new Map<string, string>(),
    };
  const eventTimes = existingEvents.map((e) => new Date(clickhouseDateToISO(e.createdAt)).getTime());
  const minEventTime = Math.min(...eventTimes);
  const maxEventTime = Math.max(...eventTimes);

  const searchStartTime = new Date(minEventTime - SESSION_DURATION_MS);
  const searchEndTime = new Date(maxEventTime + SESSION_DURATION_MS);

  // Query only relevant sessions from the new user within this time range
  const newUserSessions = (
    await getBufferedSessions(projectId, newUserId, await clickhouseSession.findByUserId(projectId, newUserId))
  ).filter(
    (session) =>
      new Date(clickhouseDateToISO(session.startedAt)) <= searchEndTime &&
      new Date(clickhouseDateToISO(session.endedAt)) >= searchStartTime,
  );

  // Create a map of session ID mappings
  const sessionIdMapping = new Map<string, string>(); // old session id -> new session id
  const sessionTimeUpdates = new Map<string, { startedAt: Date; endedAt: Date; duration: number }>(); // track time updates for existing sessions

  // we iterate through all the events and see if we can find a new session to assign it to
  for (const event of existingEvents) {
    for (const newSession of newUserSessions) {
      if (!eventBelongsToSession(event.createdAt, newSession)) {
        continue;
      }

      sessionIdMapping.set(event.sessionId, newSession.id);

      // Extend the session end only. startedAt is immutable once published, so an event
      // that predates the session never moves its start or its monthly partition.
      const eventTime = new Date(clickhouseDateToISO(event.createdAt)).getTime();
      const existing = sessionTimeUpdates.get(newSession.id);

      if (existing) {
        const currentStart = existing.startedAt.getTime();
        const newEnd = Math.max(existing.endedAt.getTime(), eventTime);

        sessionTimeUpdates.set(newSession.id, {
          startedAt: existing.startedAt,
          endedAt: new Date(newEnd),
          duration: Math.round((newEnd - currentStart) / 1000),
        });
      } else {
        const currentStart = new Date(clickhouseDateToISO(newSession.startedAt)).getTime();
        const currentEnd = new Date(clickhouseDateToISO(newSession.endedAt)).getTime();
        const newEnd = Math.max(currentEnd, eventTime);

        if (newEnd > currentEnd) {
          sessionTimeUpdates.set(newSession.id, {
            startedAt: new Date(currentStart),
            endedAt: new Date(newEnd),
            duration: Math.round((newEnd - currentStart) / 1000),
          });
        }
      }
      break;
    }
  }

  const sessionsWithTimeUpdates: Array<ClickhouseSession> = [];
  // Update the new users' sessions where activity extended them. The start never changes.
  if (sessionTimeUpdates.size > 0) {
    sessionTimeUpdates.forEach((timeUpdate, sessionId) => {
      const session = newUserSessions.find((s) => s.id === sessionId);
      if (session) {
        sessionsWithTimeUpdates.push({
          ...session,
          duration: timeUpdate.duration,
          startedAt: formatClickhouseDate(timeUpdate.startedAt),
          endedAt: formatClickhouseDate(timeUpdate.endedAt),
        });
      }
    });
  }

  return { sessionsWithTimeUpdates, sessionIdMapping };
};
