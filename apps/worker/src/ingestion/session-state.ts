import { formatClickhouseDate } from '@vemetric/common/date';
import { clickhouseDateToISO, type ClickhouseSession } from 'clickhouse';

export type StoredSession = Omit<ClickhouseSession, 'projectId' | 'userId'> & { projectId: string; userId: string };
export interface SessionState {
  revision: number;
  latestAt: string;
  session?: StoredSession;
  deleted?: boolean;
}

export function combineSession(
  current: SessionState,
  incoming: StoredSession | undefined,
  at: string,
  explicitDuration?: number,
): SessionState {
  if (
    explicitDuration !== undefined &&
    (!Number.isSafeInteger(explicitDuration) || explicitDuration < 0 || explicitDuration > 4294967295)
  ) {
    throw new Error('Invalid session duration');
  }

  // Existing callers also send whole seconds. Fixed precision keeps string comparisons chronological.
  if (at) at = formatClickhouseDate(new Date(clickhouseDateToISO(at)));
  const next: SessionState = structuredClone(current);
  next.latestAt = at > current.latestAt ? at : current.latestAt;
  if (next.deleted) return next;
  if (incoming) {
    incoming = { ...incoming, startedAt: formatClickhouseDate(new Date(clickhouseDateToISO(incoming.startedAt))) };
    const previous = next.session;
    // The start time is immutable once a session snapshot exists: it anchors the monthly
    // partition, and every persisted revision must share it. Entry metadata is compared
    // against this fixed start: arrivals before it replace metadata in processing order.
    // This intentionally does not guarantee metadata from the earliest event.
    if (!previous) {
      next.session = { ...incoming };
    } else if (incoming.startedAt < previous.startedAt) {
      next.session = {
        ...incoming,
        startedAt: previous.startedAt,
        userId: previous.userId,
        userIdentifier: previous.userIdentifier,
        userDisplayName: previous.userDisplayName,
      };
    }
    // Fill missing location fields once, regardless of the incoming event's timestamp.
    Object.assign(next.session!, {
      countryCode: previous?.countryCode || incoming.countryCode,
      city: previous?.city || incoming.city,
      latitude: previous?.latitude ?? incoming.latitude,
      longitude: previous?.longitude ?? incoming.longitude,
    });
  }

  if (next.session) {
    next.session.endedAt = next.latestAt;
    next.session.duration =
      explicitDuration ??
      Math.max(
        0,
        Math.round(
          (Date.parse(clickhouseDateToISO(next.latestAt)) - Date.parse(clickhouseDateToISO(next.session.startedAt))) /
            1000,
        ),
      );
    if (!Number.isSafeInteger(next.session.duration) || next.session.duration > 4294967295)
      throw new Error('Invalid session duration');
  }
  return next;
}

export function storedSession(session: ClickhouseSession): StoredSession {
  return { ...session, projectId: String(session.projectId), userId: String(session.userId) };
}

export function publicSession(session: StoredSession): ClickhouseSession {
  return { ...session, projectId: BigInt(session.projectId), userId: BigInt(session.userId) };
}
