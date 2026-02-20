import type { OpenAPIHono } from '@hono/zod-openapi';
import { createRoute, z } from '@hono/zod-openapi';
import { getUserFilterQueries } from 'clickhouse';
import { parseMetricsQueryGroupingToken } from 'clickhouse/src/utils/query-group';
import { getFilterFunnelsData } from '../../utils/filter';
import { isRetentionRestricted, RETENTION_UPGRADE_MESSAGE } from '../../utils/retention';
import { DEFAULT_METRICS } from '../consts/stats';
import { authorizationHeaderSchema, commonOpenApiErrorResponses } from '../schemas/common';
import { statsQueryRequestSchema, statsQueryResponseSchema } from '../schemas/stats';
import type { PublicApiHonoEnv } from '../types';
import { mapApiFilterConfig } from '../utils/api-filter-mapper';
import { resolveApiDateRange, formatApiDate } from '../utils/date';
import { ApiError } from '../utils/errors';
import { buildGroupObject } from '../utils/stats/grouping';
import { normalizeMetricValue } from '../utils/stats/metrics';
import { applyOrdering } from '../utils/stats/ordering';
import { queryMetricRows } from '../utils/stats/queries';

const statsRoute = createRoute({
  method: 'post',
  path: '/v1/stats/query',
  summary: 'Query stats',
  description: 'Query analytics metrics with optional grouping, sorting, pagination and filters.',
  request: {
    headers: authorizationHeaderSchema,
    body: {
      required: true,
      content: {
        'application/json': {
          schema: statsQueryRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Success',
      content: {
        'application/json': {
          schema: statsQueryResponseSchema,
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
    ...commonOpenApiErrorResponses,
  },
});

export function registerStatsRoutes(api: OpenAPIHono<PublicApiHonoEnv>) {
  api.openapi(statsRoute, async ({ req, json, var: { project, subscriptionStatus } }) => {
    const payload = req.valid('json');

    const grouping = parseMetricsQueryGroupingToken(payload.group_by[0] ?? null);
    const filterConfig = mapApiFilterConfig(payload.filters, payload.filtersOperator);
    const { timespan, startDate, endDate } = resolveApiDateRange(payload.date_range);
    if (
      isRetentionRestricted({
        timespan,
        startDate,
        isSubscriptionActive: subscriptionStatus.isActive,
      })
    ) {
      throw new ApiError(403, 'PLAN_LIMIT_EXCEEDED', RETENTION_UPGRADE_MESSAGE);
    }

    const selectedMetrics = payload.metrics && payload.metrics.length > 0 ? payload.metrics : DEFAULT_METRICS;
    const funnelsData = filterConfig ? await getFilterFunnelsData(project.id, filterConfig) : null;
    const { filterQueries } = getUserFilterQueries({
      filterConfig,
      projectId: BigInt(project.id),
      startDate,
      endDate,
      funnelsData: funnelsData ?? new Map(),
    });

    const metricData = await Promise.all(
      selectedMetrics.map(async (metric) => ({
        metric,
        rows: await queryMetricRows({
          metric,
          projectId: BigInt(project.id),
          startDate,
          endDate,
          grouping,
          filterQueries,
          filterConfig,
        }),
      })),
    );

    const dataByKey = new Map<string, { group: Record<string, string>; metrics: Record<string, number> }>();
    for (const { metric, rows } of metricData) {
      rows.forEach((row) => {
        const existing = dataByKey.get(row.groupKey) ?? {
          group: buildGroupObject(grouping, row.groupKey),
          metrics: {},
        };
        existing.metrics[metric] = normalizeMetricValue(metric, row.value);
        dataByKey.set(row.groupKey, existing);
      });
    }

    if (grouping.kind === 'none' && dataByKey.size === 0) {
      dataByKey.set('__all__', { group: {}, metrics: {} });
    }

    const rows = Array.from(dataByKey.values()).map((row) => ({
      group: row.group,
      metrics: selectedMetrics.reduce<Record<string, number>>((acc, metric) => {
        acc[metric] = row.metrics[metric] ?? 0;
        return acc;
      }, {}),
    }));

    const sortedRows = applyOrdering(rows, payload.order_by);
    const effectiveLimit = grouping.kind === 'none' ? 1 : payload.limit;
    const effectiveOffset = grouping.kind === 'none' ? 0 : payload.offset;
    const paginatedRows = sortedRows.slice(effectiveOffset, effectiveOffset + effectiveLimit);

    return json(
      {
        period: {
          from: formatApiDate(startDate),
          to: formatApiDate(endDate ?? new Date()),
        },
        query: {
          date_range: payload.date_range,
          group_by: payload.group_by,
          metrics: selectedMetrics,
          order_by: payload.order_by,
          limit: payload.limit,
          offset: payload.offset,
        },
        pagination: {
          limit: effectiveLimit,
          offset: effectiveOffset,
          returned: paginatedRows.length,
        },
        data: paginatedRows,
      },
      200,
    );
  });
}
