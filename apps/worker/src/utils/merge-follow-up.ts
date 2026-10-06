import { mergeUserJobOptions, mergeUserQueue } from '@vemetric/queues/merge-user-queue';
import { addToQueue } from '@vemetric/queues/queue-utils';
import { loadMergeRecord, needsFollowUp } from '../ingestion/merge-record';

// A follow-up runs a few seconds after the late activity that triggered it. Triggers within the
// deduplication window share one follow-up, which has not started yet when they arrive (window
// shorter than the delay), so it sees all of their writes.
const FOLLOW_UP_DELAY_MS = 5000;
const FOLLOW_UP_DEDUPLICATION_MS = 4000;

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

/**
 * Called after an event or session of this id was written. The merge saves its record before it
 * reads the id's events and sessions, so reading the record after the write means either this
 * check sees the merge, or the merge sees the write.
 */
export async function followUpIfMerged(
  projectId: bigint,
  userId: bigint,
  activity: { createdAt: string; sessionId?: string },
) {
  if (needsFollowUp(await loadMergeRecord(projectId, userId), userId, activity)) {
    await queueMergeFollowUp(projectId, userId);
  }
}
