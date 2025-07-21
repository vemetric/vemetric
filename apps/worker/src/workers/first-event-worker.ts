import { getStepDelay } from '@vemetric/email/email-drip-sequences';
import { emailDripQueue } from '@vemetric/queues/email-drip-queue';
import { addToQueue } from '@vemetric/queues/queue-utils';
import { Queue, Worker } from 'bullmq';
import { clickhouseDateToISO, clickhouseEvent } from 'clickhouse';
import { prismaClient } from 'database';
import { logger } from '../utils/logger';
import { vemetric } from '../utils/vemetric-client';

export async function initFirstEventWorker() {
  const firstEventQueue = new Queue('firstEvent', {
    connection: {
      url: process.env.REDIS_URL,
    },
  });

  await firstEventQueue.upsertJobScheduler(
    firstEventQueue.name,
    {
      pattern: '0 * * * *', // every hour
    },
    {
      name: 'firstEvent',
      opts: {
        backoff: 3,
        attempts: 5,
        removeOnFail: 1000,
      },
    },
  );

  return new Worker(
    firstEventQueue.name,
    async () => {
      logger.info('Starting first event feedback check');

      // Find projects that haven't had their first event recorded yet
      const projects = await prismaClient.project.findMany({
        where: {
          firstEventAt: null,
        },
        include: {
          users: {
            where: {
              role: 'ADMIN',
            },
          },
        },
      });

      let processedCount = 0;

      for (const project of projects) {
        try {
          // Get the first event timestamp
          const firstEvent = await clickhouseEvent.getFirstEvent(BigInt(project.id));

          if (firstEvent) {
            // Track the first event for analytics
            const adminUser = project.users[0];
            if (!adminUser) {
              logger.error({ projectId: project.id }, 'No admin user found for project');
              continue;
            }

            await vemetric.trackEvent('ProjectFirstEvent', {
              userIdentifier: adminUser.userId,
              eventData: {
                projectId: project.id,
                projectDomain: project.domain,
              },
            });

            // Schedule the first event feedback email for 7 days after the first event
            const delay = getStepDelay('FIRST_EVENT_FEEDBACK', 0);
            await addToQueue(
              emailDripQueue,
              {
                userId: adminUser.userId,
                sequenceType: 'FIRST_EVENT_FEEDBACK',
                stepNumber: 0,
              },
              {
                delay,
              },
            );

            // Update the project with the first event timestamp
            await prismaClient.project.update({
              where: { id: project.id },
              data: {
                firstEventAt: clickhouseDateToISO(firstEvent.createdAt),
              },
            });

            processedCount++;
            logger.info({ projectId: project.id }, 'Processed project for first event hook');
          }
        } catch (err) {
          logger.error({ err, projectId: project.id }, 'Error processing project first event hook');
        }
      }

      logger.info(`First event check completed. Processed ${processedCount} projects`);
    },
    {
      connection: {
        url: process.env.REDIS_URL,
      },
      removeOnComplete: {
        count: 10,
      },
      removeOnFail: {
        count: 1000,
      },
    },
  );
}
