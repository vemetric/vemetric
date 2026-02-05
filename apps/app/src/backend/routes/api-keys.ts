import { createHash } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import { dbApiKey } from 'database';
import { customAlphabet, nanoid } from 'nanoid';
import { z } from 'zod';
import { projectAdminProcedure, router } from '../utils/trpc';

const createKeySuffix = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 32);

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export const apiKeysRouter = router({
  create: projectAdminProcedure
    .input(z.object({ name: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const rawKey = `vem_${createKeySuffix()}`;
      const keyHash = sha256(rawKey);
      const keyPrefix = `${rawKey.slice(0, 12)}...`;

      await dbApiKey.create({
        id: `key_${nanoid()}`,
        projectId: ctx.project.id,
        name: input.name,
        keyHash,
        keyPrefix,
      });

      return { rawKey, keyPrefix };
    }),

  list: projectAdminProcedure.query(async ({ ctx }) => {
    return dbApiKey.listActiveByProjectId({ projectId: ctx.project.id });
  }),

  revoke: projectAdminProcedure
    .input(z.object({ keyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await dbApiKey.revoke({ id: input.keyId, projectId: ctx.project.id });

      if (result.count === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'API key not found' });
      }

      return { success: true };
    }),
});
