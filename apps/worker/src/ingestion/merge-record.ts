import { mergeUserJobOptions, mergeUserQueue } from '@vemetric/queues/merge-user-queue';
import { addToQueue } from '@vemetric/queues/queue-utils';
import { stateRedis } from './redis';
import { bufferSessionUpdate } from './session-buffer';
import { envPositiveInteger } from '../utils/env';

const recordTtl = envPositiveInteger('USER_MERGE_RECORD_TTL_SECONDS', 24 * 60 * 60);
// A follow-up runs a few seconds after the late activity that triggered it. Triggers within the
// deduplication window share one follow-up, which has not started yet when they arrive (window
// shorter than the delay), so it sees all of their writes.
const FOLLOW_UP_DELAY_MS = 5000;
const FOLLOW_UP_DEDUPLICATION_MS = 4000;

export const mergeRecordKey = (projectId: bigint | string, userId: bigint | string) =>
  `vm:{user-merge}:${projectId}:${userId}`;

export interface MergeEntry {
  target: string;
  // Activity of the merged id up to this hub timestamp belongs to the target (login + a few seconds).
  cutoff: string;
  identifier: string;
  displayName?: string;
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

export function mergeEntryFor(record: MergeRecord | null, createdAt: string) {
  return record?.merges?.find((entry) => createdAt <= entry.cutoff);
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
  const decided = activity.sessionId ? record.sessions?.[activity.sessionId] : undefined;
  return decided !== undefined && (decided.user !== String(userId) || decided.session !== activity.sessionId);
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
    if (!decided || decided.session === session) return;
    owner = decided.user;
    session = decided.session;
    if ((await bufferSessionUpdate(projectId, session, at)) !== 'deleted') return;
  }
}

export async function queueMergeFollowUp(projectId: bigint, userId: bigint) {
  await addToQueue(
    mergeUserQueue,
    { projectId: String(projectId), userId: String(userId) },
    {
      ...mergeUserJobOptions,
      delay: FOLLOW_UP_DELAY_MS,
      deduplication: { id: `follow-up:${projectId}:${userId}`, ttl: FOLLOW_UP_DEDUPLICATION_MS },
    },
  );
}
