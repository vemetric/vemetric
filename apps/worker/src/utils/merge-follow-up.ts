import { mergeUserJobOptions, mergeUserQueue } from '@vemetric/queues/merge-user-queue';
import { addToQueue } from '@vemetric/queues/queue-utils';

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
