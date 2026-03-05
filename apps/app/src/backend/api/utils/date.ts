import type { PresetTimeSpan, TimeSpan } from '@vemetric/common/charts/timespans';
import { clickhouseDateToISO } from 'clickhouse';
import { getTimeSpanEndDate, getTimeSpanStartDate } from '../../utils/timeseries';
import { utcDateOnlyRegex } from '../schemas/common';

export function resolveApiDateRange(dateRange: PresetTimeSpan | [string, string]): {
  timespan: TimeSpan;
  startDate: Date;
  endDate?: Date;
} {
  if (Array.isArray(dateRange)) {
    const startDate = new Date(dateRange[0]);
    const endDate = utcDateOnlyRegex.test(dateRange[1])
      ? getTimeSpanEndDate('custom', dateRange[1])
      : new Date(dateRange[1]);

    return { timespan: 'custom', startDate, endDate };
  }

  return {
    timespan: dateRange,
    startDate: getTimeSpanStartDate(dateRange),
  };
}

export function formatApiDate(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function toApiTimestamp(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const iso = clickhouseDateToISO(value);
  return formatApiDate(new Date(iso));
}
