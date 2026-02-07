import { createHash } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import { dbApiKey } from 'database';
import { customAlphabet, nanoid } from 'nanoid';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { projectAdminProcedure, router } from '../utils/trpc';
import { vemetric } from '../utils/vemetric-client';

const createKeySuffix = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 32);

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export const apiKeysRouter = router({
  create: projectAdminProcedure
    .input(z.object({ name: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const rawKey = `vem_${createKeySuffix()}`;
      const keyId = `key_${nanoid()}`;
      const keyHash = sha256(rawKey);
      const keyPrefix = `${rawKey.slice(0, 12)}...`;

      await dbApiKey.create({
        id: keyId,
        projectId: ctx.project.id,
        name: input.name,
        keyHash,
        keyPrefix,
        createdByUserId: ctx.user.id,
      });

      try {
        await vemetric.trackEvent('ApiKeyCreated', {
          userIdentifier: ctx.user.id,
          userDisplayName: ctx.user.name,
          eventData: {
            keyId,
            keyName: input.name,
            projectId: ctx.project.id,
          },
        });
      } catch (err) {
        logger.error({ err, keyId, projectId: ctx.project.id }, 'Track event error');
      }

      return { rawKey, keyPrefix };
    }),

  list: projectAdminProcedure.query(async ({ ctx }) => {
    return dbApiKey.listByProjectId({ projectId: ctx.project.id });
  }),

  revoke: projectAdminProcedure
    .input(z.object({ keyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await dbApiKey.revoke({
        id: input.keyId,
        projectId: ctx.project.id,
        revokedByUserId: ctx.user.id,
      });

      if (result.count === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'API key not found' });
      }

      try {
        await vemetric.trackEvent('ApiKeyRevoked', {
          userIdentifier: ctx.user.id,
          userDisplayName: ctx.user.name,
          eventData: {
            keyId: input.keyId,
            projectId: ctx.project.id,
          },
        });
      } catch (err) {
        logger.error({ err, keyId: input.keyId, projectId: ctx.project.id }, 'Track event error');
      }

      return { success: true };
    }),
});
