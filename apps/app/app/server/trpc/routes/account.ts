import { TRPCError } from '@trpc/server';
import { dbAuthUser } from 'database';
import { z } from 'zod';
import { logger } from '../../utils/logger';
import { getAvatarKeyPrefix, isStorageConfigured, storage } from '../utils/storage';
import { loggedInProcedure, router } from '../trpc';

export const accountRouter = router({
  settings: loggedInProcedure.query(async (opts) => {
    const { user } = opts.ctx;

    const linkedAccounts = await dbAuthUser.getLinkedAccounts(user.id);

    // Map accounts to a more usable format
    const accounts = linkedAccounts.map((account) => ({
      id: account.id,
      provider: account.providerId,
      accountId: account.accountId,
      createdAt: account.createdAt,
    }));

    // User has password if they have a credential account
    const hasPassword = accounts.some((account) => account.provider === 'credential');

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        image: user.image,
      },
      accounts,
      hasPassword,
      avatarUploadsEnabled: isStorageConfigured(),
    };
  }),

  getAvatarUploadUrl: loggedInProcedure
    .input(
      z.object({
        fileSize: z.number().max(5 * 1024 * 1024), // 5MB max
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!isStorageConfigured()) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Avatar uploads are not configured on this instance',
        });
      }

      const { user } = ctx;
      const prefix = getAvatarKeyPrefix();
      const key = `${prefix}${user.id}/${crypto.randomUUID()}.webp`;
      const uploadUrl = await storage.getSignedUploadUrl(key, 'image/webp', input.fileSize);

      return { uploadUrl, key };
    }),

  confirmAvatarUpload: loggedInProcedure
    .input(
      z.object({
        key: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!isStorageConfigured()) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Avatar uploads are not configured on this instance',
        });
      }

      const { user } = ctx;
      const prefix = getAvatarKeyPrefix();

      // Validate key belongs to this user
      if (!input.key.startsWith(`${prefix}${user.id}/`)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Invalid avatar key',
        });
      }

      const imageUrl = storage.getPublicUrl(input.key);

      // Delete old avatar if exists
      if (user.image) {
        const oldKey = storage.extractKeyFromUrl(user.image);
        if (oldKey) {
          await storage.delete(oldKey).catch((err) => {
            logger.warn({ err, oldKey, userId: user.id }, 'Failed to delete old avatar');
          });
        }
      }

      await dbAuthUser.update(user.id, { image: imageUrl });

      return { success: true, imageUrl };
    }),

  deleteAvatar: loggedInProcedure.mutation(async ({ ctx }) => {
    const { user } = ctx;
    if (user.image) {
      if (isStorageConfigured()) {
        const key = storage.extractKeyFromUrl(user.image);
        if (key) {
          await storage.delete(key).catch((err) => {
            logger.warn({ err, key, userId: user.id }, 'Failed to delete avatar from storage');
          });
        }
      }
      await dbAuthUser.update(user.id, { image: null });
    }
    return { success: true };
  }),
});
