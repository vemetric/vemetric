import { createHash } from 'crypto';
import { prismaClient } from 'database';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { projectAdminProcedure, router } from '../utils/trpc';

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export const apiKeysRouter = router({
  create: projectAdminProcedure
    .input(z.object({ name: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const rawKey = `vem_${nanoid(32)}`;
      const keyHash = sha256(rawKey);
      const keyPrefix = rawKey.slice(0, 12) + '...';

      await prismaClient.apiKey.create({
        data: {
          id: `key_${nanoid()}`,
          projectId: String(ctx.projectId),
          name: input.name,
          keyHash,
          keyPrefix,
        },
      });

      return { rawKey, keyPrefix };
    }),

  list: projectAdminProcedure.query(async ({ ctx }) => {
    return prismaClient.apiKey.findMany({
      where: { projectId: String(ctx.projectId), revokedAt: null },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }),

  revoke: projectAdminProcedure
    .input(z.object({ keyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await prismaClient.apiKey.update({
        where: { id: input.keyId, projectId: String(ctx.projectId) },
        data: { revokedAt: new Date() },
      });
    }),
});
