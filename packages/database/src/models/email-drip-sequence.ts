import type { DripSequenceType, EmailDripSequence } from '@prisma/client';
import { prismaClient } from '../client';

export type { DripSequenceType, EmailDripSequence };

export const dbEmailDripSequence = {
  completeUserSequence: async (userId: string, sequenceType: DripSequenceType) => {
    await prismaClient.emailDripSequence.update({
      where: {
        userId_sequenceType: {
          userId,
          sequenceType,
        },
      },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
  },
  completeProjectSequence: async (projectId: string, sequenceType: DripSequenceType) => {
    await prismaClient.emailDripSequence.update({
      where: {
        projectId_sequenceType: {
          projectId,
          sequenceType,
        },
      },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
  },
};
