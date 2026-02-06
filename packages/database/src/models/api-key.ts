import type { ApiKey } from '@prisma/client';
import { type DbClient, prismaClient } from '../client';

export type { ApiKey };

export const dbApiKey = {
  create: ({
    id,
    projectId,
    name,
    keyHash,
    keyPrefix,
    createdByUserId,
    client = prismaClient,
  }: {
    id: string;
    projectId: string;
    name: string;
    keyHash: string;
    keyPrefix: string;
    createdByUserId: string;
    client?: DbClient;
  }) =>
    client.apiKey.create({
      data: {
        id,
        projectId,
        name,
        keyHash,
        keyPrefix,
        createdByUserId,
      },
    }),

  findByKeyHash: ({ keyHash, client = prismaClient }: { keyHash: string; client?: DbClient }) =>
    client.apiKey.findFirst({
      where: { keyHash, revokedAt: null },
      include: { project: true },
    }),

  listByProjectId: ({ projectId, client = prismaClient }: { projectId: string; client?: DbClient }) =>
    client.apiKey.findMany({
      where: { projectId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        createdAt: true,
        revokedAt: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        revokedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),

  revoke: ({
    id,
    projectId,
    revokedByUserId,
    client = prismaClient,
  }: {
    id: string;
    projectId: string;
    revokedByUserId: string;
    client?: DbClient;
  }) =>
    client.apiKey.updateMany({
      where: { id, projectId, revokedAt: null },
      data: { revokedAt: new Date(), revokedByUserId },
    }),
};
