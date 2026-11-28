import type { UserIdentificationMap } from '@prisma/client';
import { type DbClient, prismaClient } from '../client';
export { type UserIdentificationMap } from '@prisma/client';

type UserIdentificationMapKey = Pick<UserIdentificationMap, 'projectId' | 'userId' | 'identifier'>;

export const dbUserIdentificationMap = {
  create: (projectId: string, userId: string, identifier: string) =>
    prismaClient.userIdentificationMap.create({
      data: { projectId, userId, identifier },
    }),
  createMany: (data: Array<{ projectId: string; userId: string; identifier: string }>) =>
    prismaClient.userIdentificationMap.createMany({
      data,
    }),
  update: (projectId: string, userId: string, identifier: string) =>
    prismaClient.userIdentificationMap.update({
      where: { projectId_userId: { projectId, userId } },
      data: { identifier },
    }),
  findByIdentifier: (projectId: string, identifier: string) =>
    prismaClient.userIdentificationMap.findUnique({
      where: { projectId_identifier: { projectId, identifier } },
    }),
  findOrCreate: async (
    projectId: string,
    userId: string,
    identifier: string,
  ): Promise<{ record: UserIdentificationMapKey; created: boolean }> => {
    const existing = await prismaClient.userIdentificationMap.findUnique({
      where: { projectId_identifier: { projectId, identifier } },
    });
    if (existing) {
      return { record: existing, created: false };
    }

    const { count } = await prismaClient.userIdentificationMap.createMany({
      data: [{ projectId, userId, identifier }],
      skipDuplicates: true,
    });
    if (count === 1) {
      return {
        record: { projectId, userId, identifier },
        created: true,
      };
    }

    // Another concurrent request inserted the mapping first; read its committed row.
    const winner = await prismaClient.userIdentificationMap.findUnique({
      where: { projectId_identifier: { projectId, identifier } },
    });
    if (!winner) {
      throw new Error(`User identification map entry missing after conflict: ${identifier}`);
    }

    return { record: winner, created: false };
  },
  findByUserId: (projectId: string, userId: string) =>
    prismaClient.userIdentificationMap.findUnique({
      where: { projectId_userId: { projectId, userId } },
    }),
  deleteByUserIds: (projectId: string, userIds: string[], client: DbClient = prismaClient) =>
    client.userIdentificationMap.deleteMany({
      where: { projectId, userId: { in: userIds } },
    }),
  deleteByProjectId: (projectId: string) =>
    prismaClient.userIdentificationMap.deleteMany({
      where: { projectId },
    }),
};
