import type { OpenAPIHono } from '@hono/zod-openapi';
import { createRoute, z } from '@hono/zod-openapi';
import type { FunnelStep } from '@vemetric/common/funnel';
import { clickhouseEvent, getUserFilterQueries } from 'clickhouse';
import { dbFunnel } from 'database';
import { getFilterFunnelsData } from '../../utils/filter';
import { isRetentionRestricted, RETENTION_UPGRADE_MESSAGE } from '../../utils/retention';
import { authorizationHeaderSchema, commonOpenApiErrorResponses } from '../schemas/common';
import {
  funnelIdSchema,
  funnelResultsRequestSchema,
  funnelResultsResponseSchema,
  funnelsListResponseSchema,
} from '../schemas/funnels';
import type { PublicApiHonoEnv } from '../types';
import { mapApiFilterConfig } from '../utils/api-to-internal-filter-mapper';
import { formatApiDate, resolveApiDateRange } from '../utils/date';
import { ApiError } from '../utils/errors';
import { mapFunnelStepToApi } from '../utils/funnel-step-mapper';

const funnelsListRoute = createRoute({
  method: 'get',
  path: '/v1/funnels',
  summary: 'List funnels',
  description: 'Returns the list of funnels for the authenticated project.',
  request: {
    headers: authorizationHeaderSchema,
  },
  responses: {
    200: {
      description: 'Success',
      content: {
        'application/json': {
          schema: funnelsListResponseSchema,
        },
      },
    },
    ...commonOpenApiErrorResponses,
  },
});

const funnelResultsRoute = createRoute({
  method: 'post',
  path: '/v1/funnels/{id}',
  summary: 'Get funnel results',
  description: 'Returns results for a funnel in the given date range and with optional filters.',
  request: {
    headers: authorizationHeaderSchema,
    params: z.object({
      id: funnelIdSchema,
    }),
    body: {
      required: true,
      content: {
        'application/json': {
          schema: funnelResultsRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Success',
      content: {
        'application/json': {
          schema: funnelResultsResponseSchema,
        },
      },
    },
    403: {
      description: 'Requested date range is not allowed for the current plan',
      content: {
        'application/json': {
          schema: z.object({
            error: z.object({
              code: z.literal('PLAN_LIMIT_EXCEEDED'),
              message: z.string(),
            }),
          }),
        },
      },
    },
    404: {
      description: 'Funnel was not found',
      content: {
        'application/json': {
          schema: z.object({
            error: z.object({
              code: z.literal('FUNNEL_NOT_FOUND'),
              message: z.string(),
            }),
          }),
        },
      },
    },
    ...commonOpenApiErrorResponses,
  },
});

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

export function registerFunnelRoutes(api: OpenAPIHono<PublicApiHonoEnv>) {
  api.openapi(funnelsListRoute, async ({ json, var: { project } }) => {
    const funnels = await dbFunnel.findByProjectId(project.id);

    return json(
      {
        funnels: funnels.map((funnel) => mapFunnelForApi({ ...funnel, steps: funnel.steps as FunnelStep[] })),
      },
      200,
    );
  });

  api.openapi(funnelResultsRoute, async ({ req, json, var: { project, subscriptionStatus } }) => {
    const { id } = req.valid('param');
    const payload = req.valid('json');
    const projectId = BigInt(project.id);

    const funnel = await dbFunnel.findById(id);
    if (!funnel || funnel.projectId !== project.id) {
      throw new ApiError(404, 'FUNNEL_NOT_FOUND', 'Funnel not found');
    }

    const { timespan, startDate, endDate } = resolveApiDateRange(payload.dateRange);
    if (
      isRetentionRestricted({
        timespan,
        startDate,
        isSubscriptionActive: subscriptionStatus.isActive,
      })
    ) {
      throw new ApiError(403, 'PLAN_LIMIT_EXCEEDED', RETENTION_UPGRADE_MESSAGE);
    }

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

    return json(
      {
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
      },
      200,
    );
  });
}
