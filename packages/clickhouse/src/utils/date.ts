import {
  getCustomDateRangeInterval,
  TIME_SPAN_DATA,
  type ChartInterval,
  type TimeSpan,
} from '@vemetric/common/charts/timespans';

export function clickhouseDateToISO(date: string) {
  let isoDate = `${date.replace(' ', 'T')}`;
  if (!isoDate.includes('.')) {
    isoDate = `${isoDate}.000`;
  }
  return `${isoDate}Z`;
}

function getDateTransformMethod(interval: ChartInterval) {
  let dateTransformMethod = 'toStartOfHour';

  switch (interval) {
    case 'thirty_seconds':
      // For 30-second intervals, return a special marker that will be handled in queries
      dateTransformMethod = 'THIRTY_SECONDS';
      break;
    case 'ten_minutes':
      dateTransformMethod = 'toStartOfTenMinutes';
      break;
    case 'hourly':
      dateTransformMethod = 'toStartOfHour';
      break;
    case 'daily':
      dateTransformMethod = 'toStartOfDay';
      break;
    case 'weekly':
      dateTransformMethod = 'toStartOfWeek';
      break;
    case 'monthly':
      dateTransformMethod = 'toStartOfMonth';
      break;
  }

  return dateTransformMethod;
}

interface TimeSpanOptions {
  timeSpan: TimeSpan;
  startDate?: Date;
  endDate?: Date;
}

export function formatDateExpression({ timeSpan, startDate, endDate }: TimeSpanOptions, field: string): string {
  const timeSpanData = TIME_SPAN_DATA[timeSpan];
  let timeSpanInterval = timeSpanData.interval;
  if (timeSpan === 'custom' && startDate && endDate) {
    timeSpanInterval = getCustomDateRangeInterval(startDate, endDate);
  }

  const method = getDateTransformMethod(timeSpanInterval);

  if (method === 'THIRTY_SECONDS') {
    // Round to 30-second intervals
    return `toStartOfInterval(${field}, INTERVAL 30 SECOND)`;
  }

  // Default format for standard ClickHouse functions
  return `${method}(${field})`;
}
