import type { ChartInterval } from './charts/timespans';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function floorTo(date: Date, ms: number): Date {
  return new Date(Math.floor(date.getTime() / ms) * ms);
}

/**
 * The start of the interval a date falls in, the way ClickHouse groups time series (`toStartOfHour`,
 * `toStartOfWeek(…, 1)`, …): in UTC, and weeks start on Monday. Used by the dashboard and the API, so their intervals
 * match the query results.
 */
export function getIntervalStart(interval: ChartInterval, date: Date): Date {
  switch (interval) {
    case 'thirty_seconds':
      return floorTo(date, 30 * SECOND);
    case 'ten_minutes':
      return floorTo(date, 10 * MINUTE);
    case 'hourly':
      return floorTo(date, HOUR);
    case 'daily':
      return floorTo(date, DAY);
    case 'weekly': {
      const day = floorTo(date, DAY);
      const daysSinceMonday = (day.getUTCDay() + 6) % 7;
      return new Date(day.getTime() - daysSinceMonday * DAY);
    }
    case 'monthly':
      return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }
}

function getNextIntervalStart(interval: ChartInterval, start: Date): Date {
  switch (interval) {
    case 'thirty_seconds':
      return new Date(start.getTime() + 30 * SECOND);
    case 'ten_minutes':
      return new Date(start.getTime() + 10 * MINUTE);
    case 'hourly':
      return new Date(start.getTime() + HOUR);
    case 'daily':
      return new Date(start.getTime() + DAY);
    case 'weekly':
      return new Date(start.getTime() + 7 * DAY);
    case 'monthly':
      return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  }
}

/**
 * The start of every interval in the period, also the ones without data, so a time series has no gaps: from the
 * interval the start date falls in up to the one the end date falls in. The end is exclusive like in the metric
 * queries (`createdAt < endDate`), so a period ending on an interval boundary doesn't get an empty extra interval.
 */
export function listIntervalStarts(interval: ChartInterval, startDate: Date, endDate: Date): Date[] {
  const starts: Date[] = [];
  for (let current = getIntervalStart(interval, startDate); current < endDate;) {
    starts.push(current);
    current = getNextIntervalStart(interval, current);
  }
  return starts;
}

/**
 * Whether a date falls in the interval that is still in progress (or a later one), e.g. today in a daily time series,
 * whose numbers are still growing.
 */
export function isIncompletePeriod(date: Date, interval: ChartInterval): boolean {
  return getIntervalStart(interval, date) >= getIntervalStart(interval, new Date());
}
