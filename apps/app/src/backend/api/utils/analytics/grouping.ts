import { clickhouseDateToISO } from 'clickhouse/src/utils/date';
import type { MetricsQueryGrouping } from 'clickhouse/src/utils/query-group';
import type { MetricRow } from '../../consts/analytics';
import { formatApiDate } from '../date';

export function buildGroupObject(grouping: MetricsQueryGrouping, groupKey: string): Record<string, string> {
  if (grouping.kind === 'none') {
    return {};
  }

  if (grouping.kind === 'country') {
    return { country: groupKey };
  }

  if (grouping.kind === 'interval') {
    return { date: groupKey };
  }

  return { [grouping.token as string]: groupKey };
}

export function isSortingGroupField(field: string, grouping: MetricsQueryGrouping): boolean {
  if (grouping.kind === 'none') {
    return false;
  }

  if (grouping.kind === 'country' && field === 'country') {
    return true;
  }

  if (grouping.kind === 'interval' && field === 'date') {
    return true;
  }

  return grouping.kind === 'event_prop' && field === grouping.token;
}

function normalizeGroupKey(grouping: MetricsQueryGrouping, rawGroupKey: string): string {
  if (grouping.kind !== 'interval') {
    return rawGroupKey || '__all__';
  }

  const iso = rawGroupKey.includes('T') ? rawGroupKey : clickhouseDateToISO(rawGroupKey);
  return formatApiDate(new Date(iso));
}

export function normalizeGroupKeys(rows: Array<MetricRow>, grouping: MetricsQueryGrouping): Array<MetricRow> {
  return rows.map((row) => ({
    groupKey: normalizeGroupKey(grouping, row.groupKey),
    value: row.value,
  }));
}
