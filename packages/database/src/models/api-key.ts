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
    client = prismaClient,
  }: {
    id: string;
    projectId: string;
    name: string;
    keyHash: string;
    keyPrefix: string;
    client?: DbClient;
  }) =>
    client.apiKey.create({
      data: {
        id,
        projectId,
        name,
        keyHash,
        keyPrefix,
      },
    }),

  findByKeyHash: ({ keyHash, client = prismaClient }: { keyHash: string; client?: DbClient }) =>
    client.apiKey.findFirst({
      where: { keyHash, revokedAt: null },
      include: { project: true },
    }),

  listActiveByProjectId: ({ projectId, client = prismaClient }: { projectId: string; client?: DbClient }) =>
    client.apiKey.findMany({
      where: { projectId, revokedAt: null },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),

  revoke: ({ id, projectId, client = prismaClient }: { id: string; projectId: string; client?: DbClient }) =>
    client.apiKey.updateMany({
      where: { id, projectId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
};
