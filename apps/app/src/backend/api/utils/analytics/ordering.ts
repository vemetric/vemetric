import type { MetricsQueryGrouping } from 'clickhouse';
import { isMetricApplicableForGrouping } from './metrics';
import type { Metric } from '../../consts/analytics';

type Row = { group: Record<string, string>; metrics: Record<string, number | null> };
type OrderBy = Array<[string, string]>;

/**
 * Without `orderBy`, time series are sorted by date (oldest first), other groupings by the first metric that applies to
 * the grouping (highest first): e.g. bounceRate is `null` for every page, so it can't rank pages.
 */
export function getDefaultOrderBy(grouping: MetricsQueryGrouping, metrics: Metric[]): OrderBy {
  if (grouping.kind === 'none') {
    return [];
  }

  if (grouping.kind === 'interval') {
    return [['date', 'asc']];
  }

  const rankingMetric = metrics.find((metric) => isMetricApplicableForGrouping(metric, grouping)) ?? metrics[0];
  return [[rankingMetric, 'desc']];
}

function getGroupValue(row: Row): string {
  return Object.values(row.group)[0] ?? '';
}

export function applyOrdering(rows: Row[], orderBy: OrderBy) {
  // Sort by the group value first, so rows with equal values keep a fixed order and pages don't overlap.
  const sortedByGroup = [...rows].sort((a, b) => getGroupValue(a).localeCompare(getGroupValue(b)));

  if (orderBy.length === 0) {
    return sortedByGroup;
  }

  const [field, direction] = orderBy[0];
  const factor = direction === 'desc' ? -1 : 1;

  return sortedByGroup.sort((a, b) => {
    const aValue = a.group[field] ?? a.metrics[field];
    const bValue = b.group[field] ?? b.metrics[field];

    if (aValue === bValue) return 0;
    if (aValue === undefined) return 1;
    if (bValue === undefined) return -1;

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return (aValue - bValue) * factor;
    }

    return String(aValue).localeCompare(String(bValue)) * factor;
  });
}
