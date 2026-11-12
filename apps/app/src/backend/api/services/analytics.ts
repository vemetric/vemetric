import type { z } from '@hono/zod-openapi';
import { getUserFilterQueries, parseMetricsQueryGroupingToken } from 'clickhouse';
import { assertRetentionAllowed, type ApiServiceContext } from './context';
import { getFilterFunnelsData } from '../../utils/filter';
import { DEFAULT_METRICS } from '../consts/analytics';
import type { analyticsQueryRequestSchema, analyticsQueryResponseSchema } from '../schemas/analytics';
import { buildGroupObject, listIntervalGroupKeys, resolveAutoIntervalGrouping } from '../utils/analytics/grouping';
import { getEmptyIntervalMetricValue, getEmptyMetricValue, normalizeMetricValue } from '../utils/analytics/metrics';
import { applyOrdering, getDefaultOrderBy } from '../utils/analytics/ordering';
import { queryMetricRows } from '../utils/analytics/queries';
import { mapApiFilterConfig } from '../utils/api-to-internal-filter-mapper';
import { formatApiDate, resolveApiDateRange } from '../utils/date';

export type AnalyticsQueryInput = z.output<typeof analyticsQueryRequestSchema>;
export type AnalyticsQueryResult = z.output<typeof analyticsQueryResponseSchema>;

export async function queryAnalytics(
  ctx: ApiServiceContext,
  payload: AnalyticsQueryInput,
): Promise<AnalyticsQueryResult> {
  const { project } = ctx;

  const rawGrouping = parseMetricsQueryGroupingToken(payload.groupBy[0] ?? null);
  const filterConfig = mapApiFilterConfig(payload.filters, payload.filtersOperator);
  const { timespan, startDate, endDate } = resolveApiDateRange(payload.dateRange);
  const grouping = resolveAutoIntervalGrouping(rawGrouping, { timespan, startDate, endDate });
  assertRetentionAllowed(ctx, { timespan, startDate });

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

  // Time series contain every interval of the period, so clients don't have to fill the gaps themselves.
  const emptyIntervals = new Set<string>();
  if (grouping.kind === 'interval') {
    for (const key of listIntervalGroupKeys(grouping.interval, startDate, endDate ?? new Date())) {
      if (!dataByKey.has(key)) {
        dataByKey.set(key, { group: buildGroupObject(grouping, key), metrics: {} });
        emptyIntervals.add(key);
      }
    }
  }

  const rows = Array.from(dataByKey.entries()).map(([key, row]) => ({
    group: row.group,
    metrics: selectedMetrics.reduce<Record<string, number | null>>((acc, metric) => {
      acc[metric] =
        row.metrics[metric] ??
        (emptyIntervals.has(key) ? getEmptyIntervalMetricValue(metric) : getEmptyMetricValue(metric, grouping));
      return acc;
    }, {}),
  }));

  const orderBy = payload.orderBy.length > 0 ? payload.orderBy : getDefaultOrderBy(grouping, selectedMetrics);
  const sortedRows = applyOrdering(rows, orderBy);
  const effectiveLimit = grouping.kind === 'none' ? 1 : payload.limit;
  const effectiveOffset = grouping.kind === 'none' ? 0 : payload.offset;
  const paginatedRows = sortedRows.slice(effectiveOffset, effectiveOffset + effectiveLimit);

  return {
    period: {
      from: formatApiDate(startDate),
      to: formatApiDate(endDate ?? new Date()),
    },
    query: {
      dateRange: payload.dateRange,
      groupBy: payload.groupBy,
      metrics: selectedMetrics,
      orderBy: payload.orderBy,
      limit: payload.limit,
      offset: payload.offset,
      ...(payload.filters
        ? {
            filters: payload.filters,
            filtersOperator: payload.filtersOperator,
          }
        : {}),
    },
    pagination: {
      limit: effectiveLimit,
      offset: effectiveOffset,
      returned: paginatedRows.length,
    },
    data: paginatedRows,
  };
}
