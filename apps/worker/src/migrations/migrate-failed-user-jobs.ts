import { createUserQueue, type CreateUserQueueProps } from '@vemetric/queues/create-user-queue';
import type { EnrichUserQueueProps } from '@vemetric/queues/enrich-user-queue';
import { enrichUserQueue } from '@vemetric/queues/enrich-user-queue';
import { mergeUserQueue, type MergeUserQueueProps } from '@vemetric/queues/merge-user-queue';
import { addToQueue } from '@vemetric/queues/queue-utils';
import { prismaClient } from 'database';
import { logger } from '../utils/logger';

async function migrateCreateUserJobs() {
  logger.info('Starting migration of failed create user jobs...');

  const failedJobs = await prismaClient.failedQueueJob.findMany({
    where: {
      queueName: 'create-user',
    },
    orderBy: { createdAt: 'asc' },
  });
  const migratedJobIds = new Set<string>();

  logger.info('Found ' + failedJobs.length + ' failed create-user jobs.');
  for (const job of failedJobs) {
    try {
      const jobData: CreateUserQueueProps | null = typeof job.data === 'string' ? JSON.parse(job.data) : null;
      if (!jobData) {
        continue;
      }

      const jobId = `${jobData.projectId}-${jobData.userId}-migrate`;
      if (migratedJobIds.has(jobId)) {
        continue;
      }
      logger.info({ projectId: jobData.projectId, userId: jobData.userId }, 'Re-queuing create-user job');
      migratedJobIds.add(jobId);

      await addToQueue(createUserQueue, jobData, {
        jobId: `${jobId}-${new Date().toISOString()}`,
      });
      logger.info({ projectId: jobData.projectId, userId: jobData.userId }, 'Successfully re-queued create-user job');
    } catch (err) {
      logger.error({ jobId: job.id, err }, 'Failed to re-queue create-user job');
    }
  }
}

async function migrateMergeUserJobs() {
  logger.info('Starting migration of failed merge user jobs...');

  const failedJobs = await prismaClient.failedQueueJob.findMany({
    where: {
      queueName: 'merge-user',
    },
    orderBy: { createdAt: 'asc' },
  });
  const migratedJobIds = new Set<string>();

  logger.info('Found ' + failedJobs.length + ' failed create-user jobs.');
  for (const job of failedJobs) {
    try {
      const jobData: MergeUserQueueProps | null = typeof job.data === 'string' ? JSON.parse(job.data) : null;
      if (!jobData) {
        continue;
      }

      const jobId = `${String(jobData.projectId)}-${jobData.oldUserId}-${String(jobData.newUserId)}-migrate`;
      if (migratedJobIds.has(jobId)) {
        continue;
      }
      logger.info(
        { projectId: jobData.projectId, oldUserId: jobData.oldUserId, newUserId: jobData.newUserId },
        'Re-queuing merge-user job',
      );
      migratedJobIds.add(jobId);

      await addToQueue(mergeUserQueue, jobData, {
        jobId: `${jobId}-${new Date().toISOString()}`,
      });
      logger.info(
        { projectId: jobData.projectId, oldUserId: jobData.oldUserId, newUserId: jobData.newUserId },
        'Successfully re-queued merge-user job',
      );
    } catch (err) {
      logger.error({ jobId: job.id, err }, 'Failed to re-queue merge-user job');
    }
  }
}

async function migrateEnrichUserJobs() {
  logger.info('Starting migration of failed enrich user jobs...');

  const failedJobs = await prismaClient.failedQueueJob.findMany({
    where: {
      queueName: 'enrich-user',
    },
    orderBy: { createdAt: 'asc' },
  });
  const migratedJobIds = new Set<string>();

  logger.info('Found ' + failedJobs.length + ' failed enrich-user jobs.');
  for (const job of failedJobs) {
    try {
      const jobData: EnrichUserQueueProps | null = typeof job.data === 'string' ? JSON.parse(job.data) : null;
      if (!jobData) {
        continue;
      }

      const jobId = `${jobData.projectId}-${jobData.userId}-migrate`;
      if (migratedJobIds.has(jobId)) {
        continue;
      }
      logger.info({ projectId: jobData.projectId, userId: jobData.userId }, 'Re-queuing enrich-user job');
      migratedJobIds.add(jobId);

      await addToQueue(enrichUserQueue, jobData, {
        jobId: `${jobId}-${new Date().toISOString()}`,
      });
      logger.info({ projectId: jobData.projectId, userId: jobData.userId }, 'Successfully re-queued enrich-user job');
    } catch (err) {
      logger.error({ jobId: job.id, err }, 'Failed to re-queue enrich-user job');
    }
  }
}

migrateCreateUserJobs().catch((err) => {
  logger.error({ err }, 'Create User Job Migration failed.');
  process.exit(1);
});

/*migrateMergeUserJobs().catch((err) => {
  logger.error({ err }, 'Merge User Job Migration failed.');
  process.exit(1);
});*/

/*migrateEnrichUserJobs().catch((err) => {
  logger.error({ err }, 'Enrich User Job Migration failed.');
  process.exit(1);
});*/
