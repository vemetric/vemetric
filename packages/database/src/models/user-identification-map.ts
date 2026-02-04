import { prismaClient } from '../client';
export { type UserIdentificationMap } from '@prisma/client';

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
  findByUserId: (projectId: string, userId: string) =>
    prismaClient.userIdentificationMap.findUnique({
      where: { projectId_userId: { projectId, userId } },
    }),
  deleteByProjectId: (projectId: string) =>
    prismaClient.userIdentificationMap.deleteMany({
      where: { projectId },
    }),
};
