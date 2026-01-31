import { createUnsubscribeToken } from '@vemetric/common/email-token';
import { getVemetricUrl } from '@vemetric/common/env';
import { getSequenceStep, getStepDelay, isSequenceComplete } from '@vemetric/email/email-drip-sequences';
import { emailDripQueue, type EmailDripQueueProps } from '@vemetric/queues/email-drip-queue';
import { addToQueue } from '@vemetric/queues/queue-utils';
import { Worker } from 'bullmq';
import type { Project, User } from 'database';
import { dbEmailDripSequence, prismaClient } from 'database';
import { type SequenceContext, type SequenceResult } from '../email-sequences/common';
import { processNoEventsSequence } from '../email-sequences/project-sequences';
import { processNoProjectSequence, processFirstEventFeedbackSequence } from '../email-sequences/user-sequences';

export async function initEmailWorker() {
  return new Worker(
    emailDripQueue.name,
    async (job) => {
      const data = job.data as EmailDripQueueProps;

      const emailDripSequence = await prismaClient.emailDripSequence.findUnique({
        where: getSequenceWhereClause(data),
      });
      if (emailDripSequence) {
        if (emailDripSequence.status !== 'ACTIVE') {
          // the sequence wasn't already initiated (e.g. if it was executed for the user already), so we skip it
          return;
        }

        if (emailDripSequence.currentStep !== data.stepNumber) {
          throw new Error(
            `Email drip sequence is at a different step: ${emailDripSequence.id} (currentStep: ${emailDripSequence.currentStep}, stepNumber: ${data.stepNumber})`,
          );
        }
      }

      try {
        await processEmailSequenceStep(data);
      } catch (error) {
        await prismaClient.emailDripSequence.upsert({
          where: getSequenceWhereClause(data),
          update: {
            status: 'ERROR',
          },
          create: {
            userId: 'userId' in data ? data.userId : undefined,
            projectId: 'projectId' in data ? data.projectId : undefined,
            sequenceType: data.sequenceType,
            currentStep: data.stepNumber,
            status: 'ERROR',
          },
        });
        throw error;
      }
    },
    {
      connection: emailDripQueue.opts.connection,
      removeOnComplete: {
        count: 10,
      },
      removeOnFail: {
        count: 10000,
      },
    },
  );
}

async function getUserAndProject(data: EmailDripQueueProps): Promise<{ user: User; project?: Project } | null> {
  if ('userId' in data) {
    const user = await prismaClient.user.findUnique({
      where: { id: data.userId },
      include: {
        organizations: {
          include: {
            organization: true,
          },
        },
      },
    });

    if (!user) {
      throw new Error(`User not found: ${data.userId}`);
    }

    if (!user.emailVerified) {
      throw new Error(`User email not verified: ${data.userId}`);
    }

    if (!user.receiveEmailTips) {
      // User has email tips disabled, complete the sequence
      await dbEmailDripSequence.completeUserSequence(data.userId, data.sequenceType);
      return null;
    }

    return {
      user,
    };
  }

  const project = await prismaClient.project.findUnique({
    where: { id: data.projectId },
    include: {
      organization: {
        include: {
          users: {
            where: {
              role: 'ADMIN',
              user: {
                emailVerified: true,
                receiveEmailTips: true,
              },
            },
            include: {
              user: true,
            },
            orderBy: {
              createdAt: 'asc',
            },
            take: 1,
          },
        },
      },
    },
  });

  if (!project) {
    throw new Error(`Project not found: ${data.projectId}`);
  }

  if (project.organization.users.length === 0) {
    // no user found (probably tips disabled), we skip the sequence
    await dbEmailDripSequence.completeProjectSequence(data.projectId, data.sequenceType);
    return null;
  }

  return {
    user: project.organization.users[0].user,
    project,
  };
}

async function processEmailSequenceStep(data: EmailDripQueueProps) {
  const { sequenceType, stepNumber } = data;

  const step = getSequenceStep(sequenceType, stepNumber);
  if (!step) {
    throw new Error(`Unknown step number: ${stepNumber}`);
  }

  if (stepNumber === 0) {
    // we're starting a new sequence, let's create a record for it
    await prismaClient.emailDripSequence.create({
      data: {
        userId: 'userId' in data ? data.userId : undefined,
        projectId: 'projectId' in data ? data.projectId : undefined,
        sequenceType,
        currentStep: 0,
        status: 'ACTIVE',
      },
    });
  }

  const userAndProject = await getUserAndProject(data);
  if (!userAndProject) {
    return;
  }
  const { user, project } = userAndProject;

  const sequence = await prismaClient.emailDripSequence.findUnique({
    where: {
      ...getSequenceWhereClause(data),
      status: 'ACTIVE',
    },
  });
  if (!sequence) {
    throw new Error(`No active sequence found for step: ${stepNumber}`);
  }

  const unsubscribeLink = `${getVemetricUrl('app')}/email/unsubscribe?token=${createUnsubscribeToken(user.id)}`;
  const context: SequenceContext = {
    project,
    user,
    unsubscribeLink,
    sequence,
    stepNumber,
  };

  let result: SequenceResult | undefined;
  switch (sequenceType) {
    case 'NO_EVENTS':
      result = await processNoEventsSequence(context);
      break;
    case 'NO_PROJECT':
      result = await processNoProjectSequence(context);
      break;
    case 'FIRST_EVENT_FEEDBACK':
      result = await processFirstEventFeedbackSequence(context);
      break;
    default:
      throw new Error(`Unknown sequence type: ${sequenceType}`);
  }

  if ('skipped' in result) {
    return;
  }

  if (result.success) {
    // Update sequence record
    await prismaClient.emailDripSequence.update({
      where: { id: sequence.id },
      data: {
        currentStep: stepNumber + 1,
        lastEmailSentAt: new Date(),
      },
    });

    // Record email history
    await prismaClient.emailDripHistory.create({
      data: {
        sequenceId: sequence.id,
        projectId: sequence.projectId,
        userId: user.id,
        sequenceType: sequence.sequenceType,
        stepNumber,
        emailAddress: user.email,
        messageId: result.response.MessageID,
        status: 'SENT',
      },
    });

    if (isSequenceComplete(sequence.sequenceType, stepNumber)) {
      if ('userId' in data) {
        await dbEmailDripSequence.completeUserSequence(data.userId, sequence.sequenceType);
      } else {
        await dbEmailDripSequence.completeProjectSequence(data.projectId, sequence.sequenceType);
      }
    } else {
      await addToQueue(
        emailDripQueue,
        {
          ...('userId' in data ? { userId: data.userId } : { projectId: data.projectId }),
          sequenceType: sequence.sequenceType,
          stepNumber: stepNumber + 1,
        },
        {
          delay: getStepDelay(sequence.sequenceType, stepNumber + 1),
        },
      );
    }
  } else {
    // Record failed email
    await prismaClient.emailDripHistory.create({
      data: {
        sequenceId: sequence.id,
        projectId: sequence.projectId,
        userId: user.id,
        sequenceType: sequence.sequenceType,
        stepNumber,
        emailAddress: user.email,
        status: 'FAILED',
        errorMessage: result.response.Message,
      },
    });
    throw new Error(result.response.Message);
  }
}

function getSequenceWhereClause(data: EmailDripQueueProps) {
  if ('userId' in data) {
    return { userId_sequenceType: { userId: data.userId, sequenceType: data.sequenceType } };
  }
  return { projectId_sequenceType: { projectId: data.projectId, sequenceType: data.sequenceType } };
}
