import { getDripSequence } from '@vemetric/email/email-drip-sequences';
import { emailDripQueue } from '@vemetric/queues/email-drip-queue';
import { addToQueue } from '@vemetric/queues/queue-utils';
import { clickhouseEvent } from 'clickhouse';
import { prismaClient } from 'database';
import { logger } from '../utils/logger';

async function main() {
  /** TODO: already queued
  const noProjectSequence = getDripSequence('NO_PROJECT');

  const users = await prismaClient.user.findMany({
    where: {
      emailVerified: true,
    },
    include: {
      projects: true,
    },
  });

  for (const user of users) {
    if (user.projects.length > 0) {
      continue;
    }

    const userId = user.id;
    logger.info(
      { userId, queueName: emailDripQueue.name, sequence: noProjectSequence, delayHour },
      'Queuing user for email drip sequence',
    );
    await addToQueue(
      emailDripQueue,
      {
        userId,
        sequenceType: noProjectSequence.type,
        stepNumber: 0,
      },
      {
        delay: delayHour * 60 * 60 * 1000,
      },
    );
    delayHour++;
  }*/

  let delayHour = 16;
  const noEventsSequence = getDripSequence('NO_EVENTS');

  const projects = await prismaClient.project.findMany({});

  for (const project of projects) {
    const hasEvents = (await clickhouseEvent.getAllEventsCount(BigInt(project.id))) > 0;
    if (hasEvents) {
      continue;
    }

    logger.info(
      { projectId: project.id, queueName: emailDripQueue.name, sequence: noEventsSequence },
      'Queuing project for email drip sequence',
    );
    await addToQueue(
      emailDripQueue,
      {
        projectId: project.id,
        sequenceType: noEventsSequence.type,
        stepNumber: 0,
      },
      {
        delay: delayHour * 60 * 60 * 1000,
      },
    );
    delayHour++;
  }
}

main().catch((error) => {
  logger.error('Queueing email drips failed:', error);
  process.exit(1);
});
