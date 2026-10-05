import { formatClickhouseDate } from '@vemetric/common/date';
import type { MergeUserQueueProps } from '@vemetric/queues/merge-user-queue';
import { mergeUserBackoff, mergeUserQueue } from '@vemetric/queues/merge-user-queue';
import { mergeUserQueueName } from '@vemetric/queues/queue-names';
import { DelayedError, Worker, type Job } from 'bullmq';
import { dbUserIdentificationMap } from 'database';
import { getUser } from '../ingestion';
import { loadMergeRecord, saveMergeRecord } from '../ingestion/merge-record';
import { workerName } from '../utils/env';
import { logger } from '../utils/logger';
import { reconcileUser } from '../utils/merge-user';
import { queueTelemetry } from '../utils/telemetry';

const SESSION_RECHECK_DELAY_MS = 5_000;
const MAX_SESSION_WAIT_MS = 5 * 60 * 1_000;

// Records a merge of an anonymous id into an identified user. Repeated identifications into the
// same user extend its cutoff; a merge into another user starts a new period of the anonymous id.
async function registerMerge(job: Job<MergeUserQueueProps>, projectId: bigint, source: bigint, target: bigint) {
  const identification = await dbUserIdentificationMap.findByUserId(String(projectId), String(target));
  if (!identification) {
    throw new Error(`User not found: ${target}`);
  }
  const cutoff = job.data.cutoff ?? formatClickhouseDate(new Date(job.timestamp + (job.opts.delay ?? 0)));
  const displayName = job.data.displayName ?? (await getUser(projectId, target))?.displayName;

  const record = (await loadMergeRecord(projectId, source)) ?? {};
  const merges = [...(record.merges ?? [])];
  const last = merges[merges.length - 1];
  if (last?.target === String(target)) {
    merges[merges.length - 1] = {
      ...last,
      cutoff: cutoff > last.cutoff ? cutoff : last.cutoff,
      displayName: displayName ?? last.displayName,
      firstIdentification: last.firstIdentification || job.data.firstIdentification,
    };
  } else if (!merges.some((entry) => entry.target === String(target) && entry.cutoff === cutoff)) {
    merges.push({
      target: String(target),
      cutoff,
      identifier: identification.identifier,
      displayName,
      firstIdentification: job.data.firstIdentification,
    });
    merges.sort((a, b) => (a.cutoff < b.cutoff ? -1 : 1));
  }
  await saveMergeRecord(projectId, source, { ...record, merges });
}

export async function initMergeUserWorker() {
  // Merges run one at a time across replicas; each run continues from the stored state.
  await mergeUserQueue.setGlobalConcurrency(1);
  return new Worker<MergeUserQueueProps>(
    mergeUserQueueName,
    async (job, token) => {
      const projectId = BigInt(job.data.projectId);
      let userId: bigint;
      if (job.data.oldUserId !== undefined && job.data.newUserId !== undefined) {
        const oldUserId = BigInt(job.data.oldUserId);
        const newUserId = BigInt(job.data.newUserId);
        if (oldUserId === newUserId) return;
        await registerMerge(job, projectId, oldUserId, newUserId);
        userId = oldUserId;
      } else if (job.data.userId !== undefined) {
        // A follow-up for activity that arrived after the merge.
        userId = BigInt(job.data.userId);
      } else {
        throw new Error('Merge job without user');
      }

      // A session that is still being initialized gets time to complete, so its events and entry
      // data are merged with it. A page-leave-only placeholder may never initialize.
      const startedAt = job.data.sessionWaitStartedAt;
      const waitForPendingSessions = startedAt === undefined || Date.now() - startedAt < MAX_SESSION_WAIT_MS;
      if (!waitForPendingSessions) {
        logger.warn(
          { projectId: job.data.projectId, userId: String(userId) },
          'Session did not initialize before merge',
        );
      }
      const outcome = await reconcileUser(projectId, userId, { waitForPendingSessions });
      if (outcome.pendingSessionId !== undefined) {
        const now = Date.now();
        const waitStartedAt = startedAt ?? now;
        if (startedAt === undefined) {
          await job.updateData({ ...job.data, sessionWaitStartedAt: waitStartedAt });
        }
        await job.moveToDelayed(Math.min(now + SESSION_RECHECK_DELAY_MS, waitStartedAt + MAX_SESSION_WAIT_MS), token);
        throw new DelayedError();
      }
    },
    {
      connection: {
        url: process.env.REDIS_URL,
      },
      name: workerName,
      telemetry: queueTelemetry,
      concurrency: 10,
      settings: { backoffStrategy: mergeUserBackoff },
      removeOnComplete: {
        count: 1000,
      },
    },
  );
}
