import { TRPCError } from '@trpc/server';
import type { FunnelStep } from '@vemetric/common/funnel';
import { funnelStepSchema } from '@vemetric/common/funnel';
import { clickhouseEvent } from 'clickhouse';
import { dbFunnel } from 'database';
import { z } from 'zod';
import { projectProcedure, router, timespanProcedure } from '../utils/trpc';

const createFunnelSchema = z.object({
  name: z.string().min(1, 'Funnel name is required'),
  steps: z.array(funnelStepSchema).min(1, 'At least one step is required'),
});

const updateFunnelSchema = z
  .object({
    id: z.string(),
  })
  .extend(createFunnelSchema.shape);

export const funnelsRouter = router({
  create: projectProcedure.input(createFunnelSchema).mutation(async (opts) => {
    const {
      input: { name, steps },
      ctx: { project },
    } = opts;

    const funnel = await dbFunnel.create({
      name,
      projectId: project.id,
      steps,
    });

    return { id: funnel.id };
  }),

  list: projectProcedure.query(async (opts) => {
    const {
      ctx: { project },
    } = opts;

    const funnels = await dbFunnel.findByProjectId(project.id);
    return { funnels };
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

  update: projectProcedure.input(updateFunnelSchema).mutation(async (opts) => {
    const {
      input: { id, ...updateData },
    } = opts;

    const funnel = await dbFunnel.update(id, updateData);
    return { id: funnel.id };
  }),

  delete: projectProcedure.input(z.object({ id: z.string() })).mutation(async (opts) => {
    const {
      input: { id },
    } = opts;

    await dbFunnel.delete(id);
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

      return {
        funnelResults: await clickhouseEvent.getFunnelResults(projectId, funnel.steps as FunnelStep[], startDate),
      };
    }),
});
