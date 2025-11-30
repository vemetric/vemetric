/* eslint-disable no-console */
import { createUserQueue, type CreateUserQueueProps } from '@vemetric/queues/create-user-queue';
import type { EnrichUserQueueProps } from '@vemetric/queues/enrich-user-queue';
import { enrichUserQueue } from '@vemetric/queues/enrich-user-queue';
import { mergeUserQueue, type MergeUserQueueProps } from '@vemetric/queues/merge-user-queue';
import { addToQueue } from '@vemetric/queues/queue-utils';
import { prismaClient } from 'database';

async function migrateCreateUserJobs() {
  console.log('Starting migration of failed create user jobs...');

  const failedJobs = await prismaClient.failedQueueJob.findMany({
    where: {
      queueName: 'create-user',
    },
    orderBy: { createdAt: 'asc' },
  });
  const migratedJobIds = new Set<string>();

  console.log('Found ' + failedJobs.length + ' failed create-user jobs.');
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
      console.log('Re-queuing create-user job', { projectId: jobData.projectId, userId: jobData.userId });
      migratedJobIds.add(jobId);

      await addToQueue(createUserQueue, jobData, {
        jobId: `${jobId}-${new Date().toISOString()}`,
      });
      console.log('Successfully re-queued create-user job', { projectId: jobData.projectId, userId: jobData.userId });
    } catch (err) {
      console.error('Failed to re-queue create-user job', { jobId: job.id, err });
    }
  }

  console.log(`Create user job migration completed, migrated ${migratedJobIds.size} jobs.`);
}

async function migrateMergeUserJobs() {
  console.log('Starting migration of failed merge user jobs...');

  const failedJobs = await prismaClient.failedQueueJob.findMany({
    where: {
      queueName: 'merge-user',
    },
    orderBy: { createdAt: 'asc' },
  });
  const migratedJobIds = new Set<string>();

  console.log('Found ' + failedJobs.length + ' failed create-user jobs.');
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
      console.log('Re-queuing merge-user job', {
        projectId: jobData.projectId,
        oldUserId: jobData.oldUserId,
        newUserId: jobData.newUserId,
      });
      migratedJobIds.add(jobId);

      await addToQueue(mergeUserQueue, jobData, {
        jobId: `${jobId}-${new Date().toISOString()}`,
      });
      console.log('Successfully re-queued merge-user job', {
        projectId: jobData.projectId,
        oldUserId: jobData.oldUserId,
        newUserId: jobData.newUserId,
      });
    } catch (err) {
      console.error('Failed to re-queue merge-user job', { jobId: job.id, err });
    }
  }

  console.log(`Merge user job migration completed, migrated ${migratedJobIds.size} jobs.`);
}

async function migrateEnrichUserJobs() {
  console.log('Starting migration of failed enrich user jobs...');

  const failedJobs = await prismaClient.failedQueueJob.findMany({
    where: {
      queueName: 'enrich-user',
    },
    orderBy: { createdAt: 'asc' },
  });
  const migratedJobIds = new Set<string>();

  console.log('Found ' + failedJobs.length + ' failed enrich-user jobs.');
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
      console.log('Re-queuing enrich-user job', { projectId: jobData.projectId, userId: jobData.userId });
      migratedJobIds.add(jobId);

      await addToQueue(enrichUserQueue, jobData, {
        jobId: `${jobId}-${new Date().toISOString()}`,
      });
      console.log('Successfully re-queued enrich-user job', { projectId: jobData.projectId, userId: jobData.userId });
    } catch (err) {
      console.error('Failed to re-queue enrich-user job', { jobId: job.id, err });
    }
  }

  console.log(`Enrich user job migration completed, migrated ${migratedJobIds.size} jobs.`);
}

/*migrateCreateUserJobs().catch((err) => {
  console.error({ err }, 'Create User Job Migration failed.');
  process.exit(1);
});*/

migrateMergeUserJobs().catch((err) => {
  console.error({ err }, 'Merge User Job Migration failed.');
  process.exit(1);
});

/*migrateEnrichUserJobs().catch((err) => {
  console.error({ err }, 'Enrich User Job Migration failed.');
  process.exit(1);
});*/
