import type { TimeSpan } from '@vemetric/common/charts/timespans';
import { TIME_SPAN_DATA } from '@vemetric/common/charts/timespans';

export function clickhouseDateToISO(date: string) {
  let isoDate = `${date.replace(' ', 'T')}`;
  if (!isoDate.includes('.')) {
    isoDate = `${isoDate}.000`;
  }
  return `${isoDate}Z`;
}

function getDateTransformMethod(timeSpan: TimeSpan) {
  let dateTransformMethod = 'toStartOfHour';
  const timeSpanData = TIME_SPAN_DATA[timeSpan];

  switch (timeSpanData.interval) {
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

export function formatDateExpression(timeSpan: TimeSpan, field: string): string {
  const method = getDateTransformMethod(timeSpan);

  if (method === 'THIRTY_SECONDS') {
    // Round to 30-second intervals
    return `toStartOfInterval(${field}, INTERVAL 30 SECOND)`;
  }

  // Default format for standard ClickHouse functions
  return `${method}(${field})`;
}
