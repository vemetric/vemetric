import { sessionIdRedisKey } from '@vemetric/common/session';
import { stateRedis } from './redis';
import { bufferSessionUpdate } from './session-buffer';
import { envPositiveInteger } from '../utils/env';

const recordTtl = envPositiveInteger('USER_MERGE_RECORD_TTL_SECONDS', 24 * 60 * 60);

// Points the user's current session at the session that kept the visit, unless it changed meanwhile.
const REPOINT_HUB_SESSION = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  redis.call('SET', KEYS[1], ARGV[2], 'KEEPTTL')
  return 1
end
return 0`;

// Clears the anonymous id's current session once a merge moved or merged it away, unless it changed meanwhile.
const CLEAR_HUB_SESSION = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0`;

export const mergeRecordKey = (projectId: bigint | string, userId: bigint | string) =>
  `vm:{user-merge}:${projectId}:${userId}`;

export interface MergeEntry {
  target: string;
  // Activity of the merged id up to this hub timestamp belongs to the target (login + a few seconds).
  cutoff: string;
  identifier: string;
  displayName?: string;
  // Only this session of the merged id (and its events) belongs to the target; the cutoff does not
  // apply. Used for a visit that ran on a hashed id other visitors share.
  session?: string;
}

/**
 * What a merge decided for one user id, kept for a day so that late jobs and retries end up
 * where the merge put everything else.
 */
export interface MergeRecord {
  // Set on an anonymous id that was merged into identified users, ordered by cutoff.
  merges?: MergeEntry[];
  // Where events of this id in a session belong: for every session of the merged id the merge
  // moved or merged away, and for sessions of the identified user that were merged into another.
  sessions?: Record<string, { user: string; session: string }>;
}

export async function loadMergeRecord(projectId: bigint, userId: bigint): Promise<MergeRecord | null> {
  const raw = await stateRedis().get(mergeRecordKey(projectId, userId));
  return raw ? (JSON.parse(raw) as MergeRecord) : null;
}

// Records are only written by merge jobs, which run one at a time.
export async function saveMergeRecord(projectId: bigint, userId: bigint, record: MergeRecord) {
  await stateRedis().set(mergeRecordKey(projectId, userId), JSON.stringify(record), 'EX', recordTtl);
}

export type SessionDecisions = Map<string, string>;

export function decisionsOf(records: Array<MergeRecord | null>, target?: string): SessionDecisions {
  const decisions: SessionDecisions = new Map();
  for (const record of records) {
    for (const [session, decided] of Object.entries(record?.sessions ?? {})) {
      if (target === undefined || decided.user === target) decisions.set(session, decided.session);
    }
  }
  return decisions;
}

// The merge a time belongs to; merges of a single session claim only that session.
export function mergeEntryIndexFor(merges: MergeEntry[], at: string) {
  const index = merges.findIndex((entry) => !entry.session && at <= entry.cutoff);
  return index === -1 ? undefined : index;
}

export function mergeEntryIndexForSession(merges: MergeEntry[], sessionId: string) {
  const index = merges.findIndex((entry) => entry.session === sessionId);
  return index === -1 ? undefined : index;
}

export function mergeEntryFor(record: MergeRecord | null, createdAt: string) {
  if (!record?.merges) return undefined;
  const index = mergeEntryIndexFor(record.merges, createdAt);
  return index === undefined ? undefined : record.merges[index];
}

/**
 * Whether an event or session of this id written now belongs somewhere a merge already decided:
 * activity before a merge's cutoff, or activity in a session the merge moved or merged away.
 */
export function needsFollowUp(
  record: MergeRecord | null,
  userId: bigint,
  activity: { createdAt: string; sessionId?: string },
) {
  if (!record) return false;
  if (mergeEntryFor(record, activity.createdAt)) return true;
  if (
    activity.sessionId &&
    record.merges &&
    mergeEntryIndexForSession(record.merges, activity.sessionId) !== undefined
  ) {
    return true;
  }
  const decided = activity.sessionId ? record.sessions?.[activity.sessionId] : undefined;
  return decided !== undefined && (decided.user !== String(userId) || decided.session !== activity.sessionId);
}

export async function clearHubSession(projectId: bigint, userId: bigint, sessionId: string) {
  await stateRedis().eval(CLEAR_HUB_SESSION, 1, sessionIdRedisKey(projectId, userId), sessionId);
}

export async function repointHubSession(projectId: bigint, userId: bigint, fromSessionId: string, toSessionId: string) {
  await stateRedis().eval(REPOINT_HUB_SESSION, 1, sessionIdRedisKey(projectId, userId), fromSessionId, toSessionId);
}

/**
 * Activity of a session a merge merged into another one extends the session that kept the visit
 * (following later merges of that session too).
 */
export async function continueMergedSession(projectId: bigint, userId: bigint, sessionId: string, at: string) {
  let owner = String(userId);
  let session = sessionId;
  for (let hop = 0; hop < 5; hop++) {
    const decided = (await loadMergeRecord(projectId, BigInt(owner)))?.sessions?.[session];
    if (!decided || (decided.user === owner && decided.session === session)) return;
    const sessionChanged = decided.session !== session;
    owner = decided.user;
    session = decided.session;
    if (sessionChanged && (await bufferSessionUpdate(projectId, session, at)) !== 'deleted') return;
  }
}
