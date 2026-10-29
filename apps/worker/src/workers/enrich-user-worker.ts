import { formatClickhouseDate } from '@vemetric/common/date';
import type { EnrichUserQueueProps } from '@vemetric/queues/enrich-user-queue';
import { enrichUserQueueName } from '@vemetric/queues/queue-names';
import { Worker } from 'bullmq';
import { clickhouseEvent } from 'clickhouse';
import { getUser, upsertUser } from '../ingestion';
import { workerName } from '../utils/env';
import { logger } from '../utils/logger';
import { queueTelemetry } from '../utils/telemetry';
import { getUserFirstPageViewData } from '../utils/user';

export async function initEnrichUserWorker() {
  return new Worker<EnrichUserQueueProps>(
    enrichUserQueueName,
    async (job) => {
      const { projectId: _projectId, userId: _userId } = job.data;
      const projectId = BigInt(_projectId);
      const userId = BigInt(_userId);

      const existingUser = await getUser(projectId, userId);
      if (!existingUser) {
        logger.warn({ projectId: _projectId, userId: _userId }, 'User not found for enrichment');
        return;
      }

      // Check if user already has attribution data (origin is a good indicator as it comes from a page view)
      if (existingUser.origin) {
        return;
      }

      // Fetch the first page view to get attribution data
      const firstPageView = await clickhouseEvent.getFirstPageViewByUserId(projectId, userId);
      if (!firstPageView) {
        return;
      }

      // Applied only if the user still has no attribution data
      await upsertUser(projectId, userId, {
        type: 'enrich',
        at: formatClickhouseDate(new Date()),
        firstPageView: getUserFirstPageViewData(firstPageView),
      });

      logger.info({ projectId: _projectId, userId: _userId }, 'User enrichment completed');
    },
    {
      connection: {
        url: process.env.REDIS_URL,
      },
      name: workerName,
      telemetry: queueTelemetry,
      concurrency: 10,
      removeOnComplete: {
        count: 1000,
      },
    },
  );
}
