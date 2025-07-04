import { TIME_SPAN_DATA, type TimeSpan } from '@vemetric/common/charts/timespans';
import { clickhouseDateToISO } from 'clickhouse';
import { addMinutes, addHours, addDays, addWeeks, addMonths, format } from 'date-fns';

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

export function getStartDate(timespan: TimeSpan) {
  const timeSpanData = TIME_SPAN_DATA[timespan];

  let startDate = roundDate(new Date(), timeSpanData.interval);
  switch (timespan) {
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

export function fillTimeSeries(
  timeSeries: Array<{ date: string; count: number }> | null,
  startDate: Date,
  interval: string,
) {
  if (timeSeries) {
    const filledTimeSeries = [];

    let currentDate = new Date(startDate);
    const endDate = new Date();

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
