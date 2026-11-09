import { TIME_SPAN_DATA, type TimeSpan } from '@vemetric/common/charts/timespans';
import { clickhouseDateToISO } from 'clickhouse';
import { addSeconds, addMinutes, addHours, addDays, addWeeks, addMonths, format } from 'date-fns';

function roundDate(date: Date, interval: string) {
  // Convert to UTC for consistent rounding
  const utcDate = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
    ),
  );

  switch (interval) {
    case 'thirty_seconds':
      utcDate.setUTCSeconds(utcDate.getUTCSeconds() - (utcDate.getUTCSeconds() % 30));
      utcDate.setUTCMilliseconds(0);
      break;
    case 'ten_minutes':
      utcDate.setUTCMinutes(utcDate.getUTCMinutes() - (utcDate.getUTCMinutes() % 10));
      utcDate.setUTCSeconds(0);
      utcDate.setUTCMilliseconds(0);
      break;
    case 'hourly':
      utcDate.setUTCMinutes(0);
      utcDate.setUTCSeconds(0);
      utcDate.setUTCMilliseconds(0);
      break;
    case 'daily':
      utcDate.setUTCHours(0);
      utcDate.setUTCMinutes(0);
      utcDate.setUTCSeconds(0);
      utcDate.setUTCMilliseconds(0);
      break;
    case 'weekly': {
      // Round to start of week (Monday)
      const dayOfWeek = utcDate.getUTCDay();
      const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      utcDate.setUTCDate(utcDate.getUTCDate() - daysToSubtract);
      utcDate.setUTCHours(0);
      utcDate.setUTCMinutes(0);
      utcDate.setUTCSeconds(0);
      utcDate.setUTCMilliseconds(0);
      break;
    }
    case 'monthly':
      utcDate.setUTCDate(1);
      utcDate.setUTCHours(0);
      utcDate.setUTCMinutes(0);
      utcDate.setUTCSeconds(0);
      utcDate.setUTCMilliseconds(0);
      break;
  }

  return utcDate;
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

  let startDate = roundDate(new Date(), timeSpanData.interval);
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
      startDate = addDays(startDate, -6);
      break;
    case '30days':
      startDate = addDays(startDate, -29);
      break;
    case '3months':
      startDate = addWeeks(startDate, -11);
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
export function getPreviousPeriodDates(
  startDate: Date,
  endDate: Date,
): { prevStartDate: Date; prevEndDate: Date } {
  const periodDurationMs = endDate.getTime() - startDate.getTime();

  // Previous period ends exactly when current period starts
  const prevEndDate = new Date(startDate.getTime() - 1); // 1ms before current start
  const prevStartDate = new Date(prevEndDate.getTime() - periodDurationMs);

  return { prevStartDate, prevEndDate };
}

export function fillTimeSeries(
  timeSeries: Array<{ date: string; count: number }> | null,
  startDate: Date,
  interval: string,
  endDate: Date = new Date(),
) {
  if (timeSeries) {
    const filledTimeSeries = [];

    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const existingData = timeSeries.find((pv) => {
        if (interval === 'monthly') {
          return format(pv.date, 'yyyy-MM') === format(currentDate, 'yyyy-MM');
        } else if (interval === 'weekly') {
          return format(pv.date, 'yyyy-ww') === format(currentDate, 'yyyy-ww');
        }

        const pvDate = new Date(clickhouseDateToISO(pv.date));

        if (interval === 'daily') {
          return pvDate.toDateString() === currentDate.toDateString();
        }

        return pvDate.toISOString() === currentDate.toISOString();
      });

      filledTimeSeries.push({
        count: existingData?.count || 0,
        date: currentDate.toISOString(),
      });

      switch (interval) {
        case 'thirty_seconds':
          currentDate = addSeconds(currentDate, 30);
          break;
        case 'ten_minutes':
          currentDate = addMinutes(currentDate, 10);
          break;
        case 'hourly':
          currentDate = addHours(currentDate, 1);
          break;
        case 'daily':
          currentDate = addDays(currentDate, 1);
          break;
        case 'weekly':
          currentDate = addWeeks(currentDate, 1);
          break;
        case 'monthly':
          currentDate = addMonths(currentDate, 1);
          break;
      }
    }
    timeSeries = filledTimeSeries;
  }

  return timeSeries;
}
