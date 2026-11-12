import { getCustomDateRangeInterval, TIME_SPAN_DATA, type TimeSpan } from '@vemetric/common/charts/timespans';
import { clickhouseDateToISO, type MetricsQueryGrouping } from 'clickhouse';
import type { MetricRow } from '../../consts/analytics';
import { formatApiDate } from '../date';

/** Empty values stay `""`, so a group value can always be used as a filter value. */
function formatGroupedFieldValue(groupKey: string): string {
  return groupKey.replace(/\0/g, '').trim();
}

export function buildGroupObject(grouping: MetricsQueryGrouping, groupKey: string): Record<string, string> {
  if (grouping.kind === 'none') {
    return {};
  }

  if (grouping.kind === 'interval') {
    return { date: groupKey };
  }

  return { [grouping.token]: formatGroupedFieldValue(groupKey) };
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

  const iso = rawGroupKey.includes('T') || !rawGroupKey.includes(' ') ? rawGroupKey : clickhouseDateToISO(rawGroupKey);
  return formatApiDate(new Date(iso));
}

export function normalizeGroupKeys(rows: Array<MetricRow>, grouping: MetricsQueryGrouping): Array<MetricRow> {
  return rows.map((row) => ({
    groupKey: normalizeGroupKey(grouping, row.groupKey),
    value: row.value,
  }));
}

const FIXED_INTERVAL_MS: Record<string, number> = {
  thirty_seconds: 30 * 1000,
  ten_minutes: 10 * 60 * 1000,
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
};

/** The start of the interval a date falls in, as ClickHouse groups them: in UTC, weeks start on Sunday. */
function getIntervalStart(interval: string, date: Date): Date | null {
  if (interval in FIXED_INTERVAL_MS) {
    const ms = FIXED_INTERVAL_MS[interval];
    return new Date(Math.floor(date.getTime() / ms) * ms);
  }
  if (interval === 'weekly') {
    const day = getIntervalStart('daily', date) as Date;
    return new Date(day.getTime() - day.getUTCDay() * FIXED_INTERVAL_MS.daily);
  }
  if (interval === 'monthly') {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }
  return null;
}

function getNextIntervalStart(interval: string, start: Date): Date {
  if (interval === 'weekly') {
    return new Date(start.getTime() + 7 * FIXED_INTERVAL_MS.daily);
  }
  if (interval === 'monthly') {
    return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  }
  return new Date(start.getTime() + FIXED_INTERVAL_MS[interval]);
}

/**
 * The group keys of every interval in the period, also the ones without data, so a time series has no gaps: the
 * interval the start date falls in up to the one the end date falls in.
 */
export function listIntervalGroupKeys(interval: string, startDate: Date, endDate: Date): string[] {
  const keys: string[] = [];
  let current = getIntervalStart(interval, startDate);
  while (current && current <= endDate) {
    keys.push(formatApiDate(current));
    current = getNextIntervalStart(interval, current);
  }
  return keys;
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
