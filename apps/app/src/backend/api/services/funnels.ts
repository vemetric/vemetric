import type { z } from '@hono/zod-openapi';
import type { FunnelStep } from '@vemetric/common/funnel';
import { clickhouseEvent, getUserFilterQueries } from 'clickhouse';
import { dbFunnel } from 'database';
import { assertRetentionAllowed, type ApiServiceContext } from './context';
import { getFilterFunnelsData } from '../../utils/filter';
import type {
  funnelResultsRequestSchema,
  funnelResultsResponseSchema,
  funnelsListResponseSchema,
} from '../schemas/funnels';
import { mapApiFilterConfig } from '../utils/api-to-internal-filter-mapper';
import { formatApiDate, resolveApiDateRange } from '../utils/date';
import { ApiError } from '../utils/errors';
import { mapFunnelStepToApi } from '../utils/funnel-step-mapper';

export type FunnelsListResult = z.output<typeof funnelsListResponseSchema>;
export type FunnelResultsInput = z.output<typeof funnelResultsRequestSchema>;
export type FunnelResultsResult = z.output<typeof funnelResultsResponseSchema>;

function mapFunnelForApi(funnel: {
  id: string;
  name: string;
  icon: string | null;
  steps: FunnelStep[];
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: funnel.id,
    name: funnel.name,
    icon: funnel.icon,
    steps: funnel.steps.map((step, index) => mapFunnelStepToApi(step, index)),
    createdAt: funnel.createdAt.toISOString(),
    updatedAt: funnel.updatedAt.toISOString(),
  };
}

export async function listFunnels({ project }: ApiServiceContext): Promise<FunnelsListResult> {
  const funnels = await dbFunnel.findByProjectId(project.id);

  return {
    funnels: funnels.map((funnel) => mapFunnelForApi({ ...funnel, steps: funnel.steps as FunnelStep[] })),
  };
}

export async function getFunnelResults(
  ctx: ApiServiceContext,
  funnelId: string,
  payload: FunnelResultsInput,
): Promise<FunnelResultsResult> {
  const { project } = ctx;
  const projectId = BigInt(project.id);

  const funnel = await dbFunnel.findById(funnelId);
  if (!funnel || funnel.projectId !== project.id) {
    throw new ApiError(404, 'FUNNEL_NOT_FOUND', 'Funnel not found');
  }

  const { timespan, startDate, endDate } = resolveApiDateRange(payload.dateRange);
  assertRetentionAllowed(ctx, { timespan, startDate });

  const filterConfig = mapApiFilterConfig(payload.filters, payload.filtersOperator);
  const funnelsData = filterConfig ? await getFilterFunnelsData(project.id, filterConfig) : null;
  const { filterQueries } = getUserFilterQueries({
    filterConfig,
    projectId,
    startDate,
    endDate,
    funnelsData: funnelsData ?? new Map(),
  });

  const [funnelResults, activeUsers] = await Promise.all([
    clickhouseEvent.getFunnelResults(
      projectId,
      funnel.steps as FunnelStep[],
      startDate,
      endDate,
      undefined,
      filterQueries,
    ),
    clickhouseEvent.getActiveUsers(projectId, { startDate, endDate, filterQueries }),
  ]);

  const stepsWithUsers = (funnel.steps as FunnelStep[]).map((step, index) => ({
    id: step.id,
    name: mapFunnelStepToApi(step, index).name,
    users: funnelResults[index]?.userCount || 0,
  }));
  const steps = stepsWithUsers.map((step, index) => {
    const previousUsers = index === 0 ? step.users : stepsWithUsers[index - 1]?.users || 0;
    const conversionRate = previousUsers > 0 ? Number(((step.users / previousUsers) * 100).toFixed(2)) : 0;
    return {
      ...step,
      conversionRate,
    };
  });
  const firstStepUsers = stepsWithUsers[0]?.users || 0;
  const lastStepUsers = stepsWithUsers[stepsWithUsers.length - 1]?.users || 0;
  const conversionRate = firstStepUsers > 0 ? Number(((lastStepUsers / firstStepUsers) * 100).toFixed(2)) : 0;
  const activeUserConversionRate =
    (activeUsers ?? 0) > 0 ? Number(((lastStepUsers / (activeUsers ?? 0)) * 100).toFixed(2)) : 0;

  return {
    period: {
      from: formatApiDate(startDate),
      to: formatApiDate(endDate ?? new Date()),
    },
    query: {
      dateRange: payload.dateRange,
      ...(payload.filters ? { filters: payload.filters, filtersOperator: payload.filtersOperator } : {}),
    },
    funnel: mapFunnelForApi({ ...funnel, steps: funnel.steps as FunnelStep[] }),
    results: {
      activeUsers: activeUsers ?? 0,
      steps,
      conversionRate,
      activeUserConversionRate,
    },
  };
}
