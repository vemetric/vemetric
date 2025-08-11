import { TRPCError } from '@trpc/server';
import type { FunnelStep } from '@vemetric/common/funnel';
import { funnelStepSchema } from '@vemetric/common/funnel';
import { clickhouseEvent } from 'clickhouse';
import { dbFunnel } from 'database';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { projectProcedure, router, timespanProcedure } from '../utils/trpc';
import { vemetric } from '../utils/vemetric-client';

const upsertFunnelSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Funnel name is required'),
  steps: z.array(funnelStepSchema).min(1, 'At least one step is required'),
});

export const funnelsRouter = router({
  list: timespanProcedure.query(async (opts) => {
    const {
      ctx: { project, projectId, startDate },
    } = opts;

    const funnels = await dbFunnel.findByProjectId(project.id);
    const activeUsers = (await clickhouseEvent.getActiveUsers(projectId, startDate)) ?? 0;

    const funnelsWithResults = await Promise.all(
      funnels.map(async (funnel) => {
        const steps = funnel.steps as FunnelStep[];

        const funnelResults = await clickhouseEvent.getFunnelResults(projectId, steps, startDate);

        const stepResults: Array<{ users: number }> = [{ users: activeUsers }];
        for (let i = 0; i < steps.length; i++) {
          const stageResult = funnelResults[i];
          stepResults.push({ users: stageResult?.userCount || 0 });
        }

        return {
          ...funnel,
          steps,
          stepResults,
        };
      }),
    );

    return {
      activeUsers,
      funnels: funnelsWithResults,
    };
  }),

  get: projectProcedure.input(z.object({ id: z.string() })).query(async (opts) => {
    const {
      input: { id },
      ctx: { project },
    } = opts;

    const funnel = await dbFunnel.findById(id);

    if (!funnel || funnel.projectId !== project.id) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Funnel not found' });
    }

    return { funnel };
  }),

  upsert: projectProcedure.input(upsertFunnelSchema).mutation(async (opts) => {
    const {
      input: { id, name, steps },
      ctx: { user, project },
    } = opts;

    if (id) {
      // Update existing funnel
      const funnel = await dbFunnel.update(id, { name, steps });

      try {
        await vemetric.trackEvent('FunnelUpdated', {
          userIdentifier: user.id,
          eventData: {
            projectId: project.id,
            projectDomain: project.domain,
            funnelId: id,
            funnelName: name,
          },
        });
      } catch (err) {
        logger.error({ err }, 'Track event error');
      }

      return { id: funnel.id };
    } else {
      // Create new funnel
      const funnel = await dbFunnel.create({
        name,
        projectId: project.id,
        steps,
      });

      try {
        await vemetric.trackEvent('FunnelCreated', {
          userIdentifier: user.id,
          eventData: {
            projectId: project.id,
            projectDomain: project.domain,
            funnelName: name,
          },
        });
      } catch (err) {
        logger.error({ err }, 'Track event error');
      }

      return { id: funnel.id };
    }
  }),

  delete: projectProcedure.input(z.object({ id: z.string() })).mutation(async (opts) => {
    const {
      input: { id },
      ctx: { user, project },
    } = opts;

    await dbFunnel.delete(id);

    try {
      await vemetric.trackEvent('FunnelDeleted', {
        userIdentifier: user.id,
        eventData: {
          projectId: project.id,
          projectDomain: project.domain,
          funnelId: id,
        },
      });
    } catch (err) {
      logger.error({ err }, 'Track event error');
    }

    return { success: true };
  }),

  getFunnelResults: timespanProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .query(async (opts) => {
      const {
        input: { id },
        ctx: { project, projectId, startDate },
      } = opts;

      const funnel = await dbFunnel.findById(id);
      if (!funnel || funnel.projectId !== project.id) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Funnel not found' });
      }

      const [funnelResults, activeUsers] = await Promise.all([
        clickhouseEvent.getFunnelResults(projectId, funnel.steps as FunnelStep[], startDate),
        clickhouseEvent.getActiveUsers(projectId, startDate),
      ]);

      return {
        funnelResults,
        activeUsers,
      };
    }),
});
