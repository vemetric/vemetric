import { TRPCError } from '@trpc/server';
import { filterConfigSchema, type IFilterConfig } from '@vemetric/common/filters';
import { dbSavedFilter } from 'database';
import { z } from 'zod';
import { logger } from '../utils/backend-logger';
import { projectProcedure, router } from '../utils/trpc';
import { vemetric } from '../utils/vemetric-client';

export const savedFiltersRouter = router({
  list: projectProcedure.query(async (opts) => {
    const {
      ctx: { project },
    } = opts;

    const savedFilters = await dbSavedFilter.findByProjectId(project.id);

    return {
      savedFilters: savedFilters.map((savedFilter) => ({
        ...savedFilter,
        filterConfig: savedFilter.filterConfig as IFilterConfig,
      })),
    };
  }),

  create: projectProcedure
    .input(
      z.object({
        name: z.string().min(1, 'Name is required'),
        icon: z.string().nullable(),
        filterConfig: filterConfigSchema,
      }),
    )
    .mutation(async (opts) => {
      const {
        input: { name, icon, filterConfig },
        ctx: { user, project },
      } = opts;

      const savedFilter = await dbSavedFilter.create({
        name,
        projectId: project.id,
        filterConfig,
        icon,
      });

      try {
        await vemetric.trackEvent('SavedFilterCreated', {
          userIdentifier: user.id,
          userDisplayName: user.name,
          eventData: {
            projectId: project.id,
            projectDomain: project.domain,
            savedFilterName: name,
          },
        });
      } catch (err) {
        logger.error({ err }, 'Track event error');
      }

      return { id: savedFilter.id };
    }),

  update: projectProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1, 'Name is required').optional(),
        icon: z.string().nullable().optional(),
        filterConfig: filterConfigSchema.optional(),
      }),
    )
    .mutation(async (opts) => {
      const {
        input: { id, name, icon, filterConfig },
        ctx: { project },
      } = opts;

      const existingFilter = await dbSavedFilter.findById(id);
      if (!existingFilter || existingFilter.projectId !== project.id) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Saved filter not found' });
      }

      const savedFilter = await dbSavedFilter.update(id, {
        ...(name !== undefined && { name }),
        ...(icon !== undefined && { icon }),
        ...(filterConfig !== undefined && { filterConfig }),
      });

      return { id: savedFilter.id };
    }),

  delete: projectProcedure.input(z.object({ id: z.string() })).mutation(async (opts) => {
    const {
      input: { id },
      ctx: { user, project },
    } = opts;

    const existingFilter = await dbSavedFilter.findById(id);
    if (!existingFilter || existingFilter.projectId !== project.id) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Saved filter not found' });
    }

    await dbSavedFilter.delete(id);

    try {
      await vemetric.trackEvent('SavedFilterDeleted', {
        userIdentifier: user.id,
        userDisplayName: user.name,
        eventData: {
          projectId: project.id,
          projectDomain: project.domain,
          savedFilterId: id,
        },
      });
    } catch (err) {
      logger.error({ err }, 'Track event error');
    }

    return { success: true };
  }),
});
