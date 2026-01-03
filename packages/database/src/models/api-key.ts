import { prismaClient } from '../client';
import { generateApiKey } from '../utils/id';
export { type ApiKey } from '@prisma/client';

function hashApiKey(key: string): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(key);
  return hasher.digest('hex');
}

export const dbApiKey = {
  create: async (projectId: string, name: string, expiresAt?: Date) => {
    const { key, prefix } = generateApiKey();
    const keyHash = hashApiKey(key);

    const apiKey = await prismaClient.apiKey.create({
      data: {
        projectId,
        name,
        keyHash,
        keyPrefix: prefix,
        expiresAt,
      },
    });

    // Return the full key only once during creation
    return {
      ...apiKey,
      key,
    };
  },

  findByHash: (keyHash: string) =>
    prismaClient.apiKey.findFirst({
      where: {
        keyHash,
        revokedAt: null,
      },
      include: {
        project: {
          include: {
            organization: {
              include: {
                billingInfo: true,
              },
            },
          },
        },
      },
    }),

  findById: (id: string) =>
    prismaClient.apiKey.findFirst({
      where: { id },
    }),

  findByProjectId: (projectId: string) =>
    prismaClient.apiKey.findMany({
      where: {
        projectId,
        revokedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    }),

  revoke: (id: string) =>
    prismaClient.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    }),

  updateLastUsed: (id: string) =>
    prismaClient.apiKey.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    }),

  validateAndGet: async (key: string) => {
    const keyHash = hashApiKey(key);
    const apiKey = await dbApiKey.findByHash(keyHash);

    if (!apiKey) {
      return null;
    }

    // Check if key is expired
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return null;
    }

    // Update last used timestamp (fire and forget)
    dbApiKey.updateLastUsed(apiKey.id).catch(() => {});

    return apiKey;
  },

  hashKey: hashApiKey,
};
