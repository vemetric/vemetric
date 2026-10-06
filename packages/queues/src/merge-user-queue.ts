import { Queue } from 'bullmq';
import { mergeUserQueueName } from './queue-names';
import { defaultQueueConnection } from './queue-utils';

export interface MergeUserQueueProps {
  projectId: string;
  // A merge of an anonymous id into an identified user, queued by the hub at identification.
  oldUserId?: string;
  newUserId?: string;
  displayName?: string;
  // Hub timestamp up to which the anonymous id's activity belongs to the identified user. Jobs
  // queued by earlier versions don't carry it; their creation time plus delay is used instead.
  cutoff?: string;
  // Merge only this session of the anonymous id (and its events), not all of its activity up to
  // the cutoff: the start of a visit that ran on a hashed id other visitors share.
  sessionId?: string;
  // A follow-up for an id whose activity arrived after its merge, queued by the ingestion workers.
  userId?: string;
  // First readiness postponement, persisted so worker restarts do not reset the deadline.
  sessionWaitStartedAt?: number;
}

// Merges continue from the stored state on every attempt, so they keep retrying for about four
// hours: exponential delays from one second, capped at 15 minutes.
export const mergeUserJobOptions = { attempts: 25, backoff: { type: 'custom' } } as const;
export const mergeUserBackoff = (attemptsMade: number) =>
  Math.min(2 ** Math.max(0, attemptsMade - 1) * 1000, 15 * 60 * 1000);

export const mergeUserQueue = new Queue<MergeUserQueueProps>(mergeUserQueueName, {
  connection: defaultQueueConnection,
});
