import { formatClickhouseDate } from '@vemetric/common/date';
import type { ClickhouseEvent, ClickhouseSession } from 'clickhouse';
import { clickhouseDevice, clickhouseEvent, clickhouseSession, getDeviceId } from 'clickhouse';
import { insertDeviceIfNotExists } from './device';
import { logger } from './logger';
import { planVisits, resolveSession, SESSION_GAP_MS, toMs, visitForTime, type Visit } from './merge-plan';
import { getUserFirstPageViewData } from './user';
import {
  bufferSessionUpdate,
  deleteBufferedSession,
  findPendingSession,
  getBufferedSessions,
  reassignBufferedSession,
  stateRedis,
  upsertUser,
} from '../ingestion';
import { loadMergeRecord, saveMergeRecord, type MergeEntry, type MergeRecord } from '../ingestion/merge-record';

// The hub's key for a user's current session (apps/hub/src/utils/session.ts).
const hubSessionKey = (projectId: bigint, userId: bigint | string) => `sessionid:${projectId}:${userId}`;
// Points the user's current session at the session that kept the visit, unless it changed meanwhile.
const REPOINT_HUB_SESSION = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  redis.call('SET', KEYS[1], ARGV[2], 'KEEPTTL')
  return 1
end
return 0`;

type Decisions = Map<string, string>;

function decisionsOf(...records: Array<MergeRecord | null>): Decisions {
  const decisions: Decisions = new Map();
  for (const record of records) {
    for (const [session, decided] of Object.entries(record?.sessions ?? {})) decisions.set(session, decided.session);
  }
  return decisions;
}

const planSession = (session: ClickhouseSession, source: boolean) => ({
  id: session.id,
  source,
  startedAt: toMs(session.startedAt),
  endedAt: toMs(session.endedAt),
});

// Sessions of the identified user near the given time range, including all sessions chained to
// them by gaps shorter than the session duration.
async function loadTargetSessions(projectId: bigint, target: bigint, from: number, to: number) {
  let start = from - SESSION_GAP_MS;
  let end = to + SESSION_GAP_MS;
  let sessions: ClickhouseSession[] = [];
  for (let round = 0; round < 10; round++) {
    const persisted = await clickhouseSession.findByUserId(projectId, target, {
      start: new Date(start),
      end: new Date(end),
    });
    sessions = (await getBufferedSessions(projectId, target, persisted)).filter(
      (session) => toMs(session.startedAt) <= end && toMs(session.endedAt) >= start,
    );
    const nextStart = Math.min(start, ...sessions.map((session) => toMs(session.startedAt) - SESSION_GAP_MS));
    const nextEnd = Math.max(end, ...sessions.map((session) => toMs(session.endedAt) + SESSION_GAP_MS));
    if (nextStart === start && nextEnd === end) break;
    start = nextStart;
    end = nextEnd;
  }
  return sessions;
}

// The merge a time belongs to; merges of a single session claim only that session.
function entryIndexFor(merges: MergeEntry[], at: string) {
  const index = merges.findIndex((entry) => !entry.session && at <= entry.cutoff);
  return index === -1 ? undefined : index;
}

function entryIndexForSession(merges: MergeEntry[], sessionId: string) {
  const index = merges.findIndex((entry) => entry.session === sessionId);
  return index === -1 ? undefined : index;
}

export interface MergeOutcome {
  // A session of the merged id that is still being initialized; the job waits for it.
  pendingSessionId?: string;
  // Identified users the merge moved activity to.
  targets: bigint[];
}

/**
 * Brings everything of `userId` to where its merges decided: its activity up to each merge's
 * cutoff (and later activity in sessions that moved) goes to the identified user, visits of both
 * ids less than the session duration apart become one session, and events of sessions merged
 * into another follow them. Every step reads the current state first, so a retry or a follow-up
 * for late activity continues where an earlier run stopped.
 */
export async function reconcileUser(
  projectId: bigint,
  userId: bigint,
  { waitForPendingSessions = true } = {},
): Promise<MergeOutcome> {
  const record = await loadMergeRecord(projectId, userId);
  if (!record) return { targets: [] };
  let targets: bigint[] = [];
  if (record.merges?.length) {
    const outcome = await mergeIntoTargets(projectId, userId, record, waitForPendingSessions);
    if (outcome.pendingSessionId) return outcome;
    targets = outcome.targets;
  }
  await moveEventsOfMergedSessions(projectId, userId, (await loadMergeRecord(projectId, userId)) ?? record);
  for (const target of targets) {
    const targetRecord = await loadMergeRecord(projectId, target);
    if (targetRecord) await moveEventsOfMergedSessions(projectId, target, targetRecord);
  }
  return { targets };
}

async function mergeIntoTargets(
  projectId: bigint,
  source: bigint,
  record: MergeRecord,
  waitForPendingSessions: boolean,
): Promise<MergeOutcome> {
  const merges = record.merges!;
  const sourceEvents = await clickhouseEvent.findByUserId(projectId, source);
  const sourceSessions = await getBufferedSessions(
    projectId,
    source,
    await clickhouseSession.findByUserId(projectId, source),
  );
  const decided = record.sessions ?? {};
  const liveSourceSessions = new Map(sourceSessions.map((session) => [session.id, session]));

  // Which merge each session and event belongs to: decided sessions keep their decision, other
  // sessions go by their start, events follow their session and otherwise go by their own time.
  const sessionEntry = new Map<string, number>();
  for (const session of sourceSessions) {
    const decision = decided[session.id];
    const index = decision
      ? merges.findIndex((entry) => entry.target === decision.user)
      : (entryIndexForSession(merges, session.id) ??
        entryIndexFor(merges, formatClickhouseDate(new Date(toMs(session.startedAt)))));
    if (index !== undefined && index !== -1) sessionEntry.set(session.id, index);
  }
  const eventEntry = (event: ClickhouseEvent) => {
    const decision = decided[event.sessionId];
    if (decision) return merges.findIndex((entry) => entry.target === decision.user);
    if (liveSourceSessions.has(event.sessionId)) return sessionEntry.get(event.sessionId);
    return (
      entryIndexForSession(merges, event.sessionId) ??
      entryIndexFor(merges, formatClickhouseDate(new Date(toMs(event.createdAt))))
    );
  };
  const movingEvents = sourceEvents
    .map((event) => ({ event, index: eventEntry(event) }))
    .filter((item): item is { event: ClickhouseEvent; index: number } => item.index !== undefined && item.index >= 0);

  // A placeholder in Redis means a session job has started but not initialized the session yet.
  if (waitForPendingSessions) {
    const pendingSessionId = await findPendingSession(projectId, [
      ...movingEvents.map(({ event }) => event.sessionId).filter(Boolean),
      ...Array.from(sessionEntry.keys()),
    ]);
    if (pendingSessionId !== undefined) return { pendingSessionId, targets: [] };
  }

  const targets: bigint[] = [];
  const remainingEvents = new Set(sourceEvents.map((event) => event.id));
  for (const [index, entry] of Array.from(merges.entries())) {
    const target = BigInt(entry.target);
    const entrySessions = sourceSessions.filter((session) => sessionEntry.get(session.id) === index);
    const entryEvents = movingEvents.filter((item) => item.index === index).map(({ event }) => event);
    if (!entrySessions.length && !entryEvents.length) continue;
    targets.push(target);

    // Plan the sessions this merge has not decided yet against the identified user's sessions.
    const times = [
      ...entrySessions.flatMap((session) => [toMs(session.startedAt), toMs(session.endedAt)]),
      ...entryEvents.map((event) => toMs(event.createdAt)),
    ];
    const targetSessions = await loadTargetSessions(projectId, target, Math.min(...times), Math.max(...times));
    const undecided = entrySessions.filter((session) => !decided[session.id]);
    const { visits, survivors } = planVisits([
      ...undecided.map((session) => planSession(session, true)),
      ...targetSessions.map((session) => planSession(session, false)),
    ]);

    // Save the decisions before writing anything: a retry or follow-up executes them as decided.
    const targetRecord = (await loadMergeRecord(projectId, target)) ?? {};
    const sourceSessionIds = new Set(entrySessions.map((session) => session.id));
    for (const [member, survivor] of Array.from(survivors.entries())) {
      if (sourceSessionIds.has(member)) decided[member] = { user: entry.target, session: survivor };
      // The identified user's events of every merged-away session follow it too, including a session
      // of the merged id that the user continued at login.
      if (member !== survivor) {
        targetRecord.sessions = { ...targetRecord.sessions, [member]: { user: entry.target, session: survivor } };
      }
    }
    record.sessions = decided;
    await saveMergeRecord(projectId, source, record);
    if (targetRecord.sessions) await saveMergeRecord(projectId, target, targetRecord);

    const decisions = decisionsOf(record, targetRecord);
    await applySessionDecisions(
      projectId,
      source,
      target,
      entry,
      entrySessions,
      targetSessions,
      entryEvents,
      decisions,
    );

    // Events of sessions this run does not know as sessions take the visit they fall into.
    const moves = entryEvents.map((event) => {
      let sessionId = decisions.has(event.sessionId) ? resolveSession(decisions, event.sessionId) : undefined;
      if (sessionId === undefined) {
        const visit: Visit | undefined = visitForTime(visits, toMs(event.createdAt));
        sessionId = visit ? resolveSession(decisions, visit.survivor) : event.sessionId;
      }
      remainingEvents.delete(event.id);
      return {
        from: event,
        to: {
          ...event,
          userId: target,
          deviceId: getDeviceId(projectId, target, event),
          sessionId,
          userIdentifier: entry.identifier,
          userDisplayName: entry.displayName,
        },
      };
    });
    await clickhouseEvent.moveEvents(moves);

    const devices = new Map(moves.map(({ to }) => [to.deviceId, to]));
    for (const [deviceId, event] of Array.from(devices.entries())) {
      await insertDeviceIfNotExists(projectId, target, deviceId, event);
    }

    // The identified user's attribution (origin, referrer, UTM tags, first seen) comes from its
    // earliest page view, now including the merged ones.
    if (moves.length) {
      const firstPageView = await clickhouseEvent.getFirstPageViewByUserId(projectId, target);
      if (firstPageView) {
        await upsertUser(projectId, target, {
          type: 'attribute',
          at: formatClickhouseDate(new Date()),
          firstPageView: getUserFirstPageViewData(firstPageView),
        });
      }
    }
  }

  // Devices of the merged id without remaining events moved with them.
  if (remainingEvents.size < sourceEvents.length) {
    const usedDevices = new Set(
      sourceEvents.filter((event) => remainingEvents.has(event.id)).map((event) => String(event.deviceId)),
    );
    const unused = (await clickhouseDevice.findByUserId(projectId, source)).filter(
      (device) => !usedDevices.has(String(device.id)),
    );
    if (unused.length) await clickhouseDevice.delete(unused);
  }

  logger.info(
    { projectId: String(projectId), userId: String(source), moved: sourceEvents.length - remainingEvents.size },
    'Merged user activity',
  );
  return { targets };
}

async function applySessionDecisions(
  projectId: bigint,
  source: bigint,
  target: bigint,
  entry: MergeEntry,
  entrySessions: ClickhouseSession[],
  targetSessions: ClickhouseSession[],
  entryEvents: ClickhouseEvent[],
  decisions: Decisions,
) {
  const known = new Map([...targetSessions, ...entrySessions].map((session) => [session.id, session]));
  // Sessions of the merged id that keep their visit move to the identified user.
  for (const session of entrySessions) {
    if (resolveSession(decisions, session.id) === session.id) {
      await reassignBufferedSession(projectId, session.id, target, entry.identifier, entry.displayName);
    }
  }

  // Every session that keeps a visit first extends to the end of everything merged into it,
  // then the others are deleted and current sessions in the hub point to the one that kept it.
  const merged = new Map<string, string[]>();
  for (const session of Array.from(decisions.keys())) {
    const survivor = resolveSession(decisions, session);
    if (survivor !== session) merged.set(survivor, [...(merged.get(survivor) ?? []), session]);
  }
  for (const [survivor, members] of Array.from(merged.entries())) {
    const memberEvents = entryEvents.filter((event) => members.includes(event.sessionId));
    const ends = [
      ...members.map((member) => known.get(member)?.endedAt).filter((end): end is string => end !== undefined),
      ...memberEvents.map((event) => event.createdAt),
    ].map(toMs);
    if (ends.length && known.has(survivor) && Math.max(...ends) > toMs(known.get(survivor)!.endedAt)) {
      await bufferSessionUpdate(projectId, survivor, formatClickhouseDate(new Date(Math.max(...ends))));
    }
    for (const member of members) {
      await deleteBufferedSession(projectId, member);
      for (const owner of [source, target]) {
        await stateRedis().eval(REPOINT_HUB_SESSION, 1, hubSessionKey(projectId, owner), member, survivor);
      }
    }
  }
}

// Events of this id in its own sessions that were merged into another session of the same user.
async function moveEventsOfMergedSessions(projectId: bigint, userId: bigint, record: MergeRecord) {
  const decisions = decisionsOf(record);
  const ownMerged = Object.entries(record.sessions ?? {})
    .filter(([session, decided]) => decided.user === String(userId) && decided.session !== session)
    .map(([session]) => session);
  const events = await clickhouseEvent.findByUserIdInSessions(projectId, userId, ownMerged);
  if (!events.length) return;
  await clickhouseEvent.moveEvents(
    events.map((event) => ({ from: event, to: { ...event, sessionId: resolveSession(decisions, event.sessionId) } })),
  );
}
