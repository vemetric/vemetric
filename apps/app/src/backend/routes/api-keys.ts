import { createHash } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import { dbApiKey, dbProject } from 'database';
import { customAlphabet, nanoid } from 'nanoid';
import { z } from 'zod';
import { logger } from '../utils/backend-logger';
import { organizationAdminProcedure, projectAdminProcedure, router } from '../utils/trpc';
import { vemetric } from '../utils/vemetric-client';

const createKeySuffix = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 32);

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function generateApiKey() {
  const rawKey = `vem_${createKeySuffix()}`;
  return {
    rawKey,
    keyId: `key_${nanoid()}`,
    keyHash: sha256(rawKey),
    keyPrefix: `${rawKey.slice(0, 12)}...`,
  };
}

async function trackApiKeyEvent(
  name: 'ApiKeyCreated' | 'ApiKeyRevoked',
  user: { id: string; name: string },
  eventData: Record<string, unknown>,
) {
  try {
    await vemetric.trackEvent(name, {
      userIdentifier: user.id,
      userDisplayName: user.name,
      eventData,
    });
  } catch (err) {
    logger.error({ err, ...eventData }, 'Track event error');
  }
}

const keyNameSchema = z.string().min(1).max(100);

export const apiKeysRouter = router({
  create: projectAdminProcedure.input(z.object({ name: keyNameSchema })).mutation(async ({ ctx, input }) => {
    const { rawKey, keyId, keyHash, keyPrefix } = generateApiKey();

    await dbApiKey.create({
      id: keyId,
      organizationId: ctx.project.organizationId,
      projectId: ctx.project.id,
      name: input.name,
      keyHash,
      keyPrefix,
      createdByUserId: ctx.user.id,
    });

    await trackApiKeyEvent('ApiKeyCreated', ctx.user, {
      keyId,
      keyName: input.name,
      scope: 'project',
      projectId: ctx.project.id,
    });

    return { rawKey, keyPrefix };
  }),

  list: projectAdminProcedure.query(async ({ ctx }) => {
    return dbApiKey.listByProjectId({ projectId: ctx.project.id });
  }),

  /** The active organization keys that also cover the project, shown as a hint in the project settings. */
  listOrganizationKeysForProject: projectAdminProcedure.query(async ({ ctx }) => {
    return dbApiKey.listActiveOrganizationKeysForProject({
      organizationId: ctx.project.organizationId,
      projectId: ctx.project.id,
    });
  }),

  revoke: projectAdminProcedure.input(z.object({ keyId: z.string() })).mutation(async ({ ctx, input }) => {
    const result = await dbApiKey.revoke({
      id: input.keyId,
      projectId: ctx.project.id,
      revokedByUserId: ctx.user.id,
    });

    if (result.count === 0) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'API key not found' });
    }

    await trackApiKeyEvent('ApiKeyRevoked', ctx.user, { keyId: input.keyId, projectId: ctx.project.id });

    return { success: true };
  }),

  createOrganizationKey: organizationAdminProcedure
    .input(
      z.object({
        name: keyNameSchema,
        allProjects: z.boolean(),
        projectIds: z.array(z.string()).max(1000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const projectIds = input.allProjects ? [] : [...new Set(input.projectIds)];
      if (!input.allProjects) {
        if (projectIds.length === 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Choose at least one project for the API key.' });
        }

        const projects = await dbProject.findByIds({ ids: projectIds, organizationId: ctx.organizationId });
        if (projects.length !== projectIds.length) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Only projects within the organization can be chosen.',
          });
        }
      }

      const { rawKey, keyId, keyHash, keyPrefix } = generateApiKey();

      await dbApiKey.create({
        id: keyId,
        organizationId: ctx.organizationId,
        allProjects: input.allProjects,
        projectIds,
        name: input.name,
        keyHash,
        keyPrefix,
        createdByUserId: ctx.user.id,
      });

      await trackApiKeyEvent('ApiKeyCreated', ctx.user, {
        keyId,
        keyName: input.name,
        scope: 'organization',
        organizationId: ctx.organizationId,
        allProjects: input.allProjects,
        projectCount: projectIds.length,
      });

      return { rawKey, keyPrefix };
    }),

  listOrganizationKeys: organizationAdminProcedure.query(async ({ ctx }) => {
    const keys = await dbApiKey.listByOrganizationId({ organizationId: ctx.organizationId });
    return keys.map(({ projects, ...key }) => ({ ...key, projects: projects.map(({ project }) => project) }));
  }),

  revokeOrganizationKey: organizationAdminProcedure
    .input(z.object({ keyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await dbApiKey.revoke({
        id: input.keyId,
        organizationId: ctx.organizationId,
        revokedByUserId: ctx.user.id,
      });

      if (result.count === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'API key not found' });
      }

      await trackApiKeyEvent('ApiKeyRevoked', ctx.user, { keyId: input.keyId, organizationId: ctx.organizationId });

      return { success: true };
    }),
});
