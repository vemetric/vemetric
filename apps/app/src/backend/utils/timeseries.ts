import { TIME_SPAN_DATA, type ChartInterval, type TimeSpan } from '@vemetric/common/charts/timespans';
import { getIntervalStart, listIntervalStarts } from '@vemetric/common/intervals';
import { clickhouseDateToISO } from 'clickhouse';
import { addSeconds, addMinutes, addHours } from 'date-fns';

// Days and weeks in UTC: date-fns' addDays and addWeeks keep the local time, which shifts by an hour across a DST
// change when the server doesn't run in UTC.
function addDaysUTC(date: Date, amount: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + amount);
  return result;
}

function addMonthsUTC(date: Date, amount: number): Date {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + amount);
  return result;
}

function addYearsUTC(date: Date, amount: number): Date {
  const result = new Date(date);
  result.setUTCFullYear(result.getUTCFullYear() + amount);
  return result;
}

export function getTimeSpanStartDate(timespan: TimeSpan, customStartDate?: string) {
  if (timespan === 'custom' && customStartDate) {
    return new Date(customStartDate + 'T00:00:00Z');
  }

  const timeSpanData = TIME_SPAN_DATA[timespan];

  let startDate = getIntervalStart(timeSpanData.interval, new Date());
  switch (timespan) {
    case 'live':
      startDate = addSeconds(addMinutes(startDate, -4), -30);
      break;
    case '1hr':
      startDate = addMinutes(startDate, -50);
      break;
    case '24hrs':
      startDate = addHours(startDate, -23);
      break;
    case '7days':
      startDate = addDaysUTC(startDate, -6);
      break;
    case '30days':
      startDate = addDaysUTC(startDate, -29);
      break;
    case '3months':
      startDate = addDaysUTC(startDate, -11 * 7);
      break;
    case '6months':
      startDate = addMonthsUTC(startDate, -5);
      break;
    case '1year':
      startDate = addYearsUTC(startDate, -1);
      break;
  }

  return startDate;
}

export function getTimeSpanEndDate(timespan: TimeSpan, customEndDate?: string) {
  if (timespan === 'custom' && customEndDate) {
    const endDate = new Date(customEndDate + 'T23:59:59Z');
    return endDate;
  }
  return undefined;
}

/**
 * Returns the previous period's start and end dates based on the current period.
 * For example, if the current period is "Last 7 days", the previous period would be
 * the 7 days before that.
 */
export function getPreviousPeriodDates(startDate: Date, endDate: Date): { prevStartDate: Date; prevEndDate: Date } {
  const periodDurationMs = endDate.getTime() - startDate.getTime();

  // Previous period ends exactly when current period starts
  const prevEndDate = new Date(startDate.getTime() - 1); // 1ms before current start
  const prevStartDate = new Date(prevEndDate.getTime() - periodDurationMs);

  return { prevStartDate, prevEndDate };
}

/**
 * Adds the intervals without data to a time series of the dashboard (with a count of 0), so its charts have no gaps.
 * Uses the same intervals as the API's time series (`listIntervalStarts`).
 */
export function fillTimeSeries(
  timeSeries: Array<{ date: string; count: number }> | null,
  startDate: Date,
  interval: ChartInterval,
  endDate: Date = new Date(),
) {
  if (!timeSeries) {
    return timeSeries;
  }

  const countByStart = new Map(
    timeSeries.map(({ date, count }) => [
      getIntervalStart(interval, new Date(clickhouseDateToISO(date))).getTime(),
      count,
    ]),
  );
  return listIntervalStarts(interval, startDate, endDate).map((start) => ({
    count: countByStart.get(start.getTime()) || 0,
    date: start.toISOString(),
  }));
}
