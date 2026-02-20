import type { Metric } from '../../consts/stats';

export function normalizeMetricValue(metric: Metric, value: number): number {
  if (metric === 'users' || metric === 'pageviews' || metric === 'events') {
    return Number.isFinite(value) ? Math.round(value) : 0;
  }

  if (!Number.isFinite(value)) {
    return 0;
  }

  return Number(value.toFixed(2));
}
