import { getCustomDateRangeInterval, TIME_SPAN_DATA, type TimeSpan } from '@vemetric/common/charts/timespans';
import { clickhouseDateToISO, type MetricsQueryGrouping } from 'clickhouse';
import type { MetricRow } from '../../consts/analytics';
import { formatApiDate } from '../date';

function formatGroupedFieldValue(token: string, groupKey: string): string {
  const normalizedGroupKey = groupKey.replace(/\0/g, '').trim();
  if (normalizedGroupKey !== '') {
    return normalizedGroupKey;
  }

  switch (token) {
    case 'referrer':
      return 'Direct / None';
    case 'referrerType':
      return 'unknown';
    case 'deviceType':
      return 'unknown';
    default:
      return 'Unknown';
  }
}

export function buildGroupObject(grouping: MetricsQueryGrouping, groupKey: string): Record<string, string> {
  if (grouping.kind === 'none') {
    return {};
  }

  if (grouping.kind === 'interval') {
    return { date: groupKey };
  }

  return { [grouping.token]: formatGroupedFieldValue(grouping.token, groupKey) };
}

export function isSortingGroupField(field: string, grouping: MetricsQueryGrouping): boolean {
  if (grouping.kind === 'none') {
    return false;
  }

  if (grouping.kind === 'field') {
    return field === grouping.token;
  }

  if (grouping.kind === 'interval' && field === 'date') {
    return true;
  }

  return grouping.kind === 'event_prop' && field === grouping.token;
}

function normalizeGroupKey(grouping: MetricsQueryGrouping, rawGroupKey: string): string {
  if (grouping.kind === 'none') {
    return rawGroupKey || '__all__';
  }

  if (grouping.kind !== 'interval') {
    return rawGroupKey;
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

export function resolveAutoIntervalGrouping(
  grouping: MetricsQueryGrouping,
  options: {
    timespan: TimeSpan;
    startDate: Date;
    endDate?: Date;
  },
): MetricsQueryGrouping {
  if (grouping.kind !== 'interval' || grouping.interval !== 'auto') {
    return grouping;
  }

  const interval =
    options.timespan === 'custom' && options.endDate
      ? getCustomDateRangeInterval(options.startDate, options.endDate)
      : TIME_SPAN_DATA[options.timespan].interval;

  return { ...grouping, interval };
}
