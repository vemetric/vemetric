import type { MetricsQueryGrouping } from 'clickhouse';
import type { Metric } from '../../consts/analytics';

export function normalizeMetricValue(metric: Metric, value: number): number {
  if (metric === 'users' || metric === 'pageviews' || metric === 'events') {
    return Number.isFinite(value) ? Math.round(value) : 0;
  }

  if (!Number.isFinite(value)) {
    return 0;
  }

  return Number(value.toFixed(2));
}

export function isMetricApplicableForGrouping(metric: Metric, grouping: MetricsQueryGrouping): boolean {
  if (grouping.kind === 'none' || grouping.kind === 'interval') {
    return true;
  }

  if (grouping.kind === 'event_prop') {
    return metric !== 'bounce_rate' && metric !== 'visit_duration';
  }

  if (grouping.kind === 'field') {
    if (grouping.token === 'event:name') {
      return metric !== 'bounce_rate' && metric !== 'visit_duration';
    }

    if (grouping.token === 'page:path' || grouping.token === 'page:origin') {
      return metric !== 'bounce_rate' && metric !== 'visit_duration';
    }

    if (
      (grouping.token === 'browser' || grouping.token === 'device_type' || grouping.token === 'os') &&
      metric === 'visit_duration'
    ) {
      return false;
    }
  }

  return true;
}

export function getEmptyMetricValue(metric: Metric, grouping: MetricsQueryGrouping): number | null {
  return isMetricApplicableForGrouping(metric, grouping) ? 0 : null;
}
