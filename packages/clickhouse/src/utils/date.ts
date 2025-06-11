import type { TimeSpan } from '@vemetric/common/charts/timespans';
import { TIME_SPAN_DATA } from '@vemetric/common/charts/timespans';

export function clickhouseDateToISO(date: string) {
  return `${date.replace(' ', 'T')}.000Z`;
}

export function getDateTransformMethod(timeSpan: TimeSpan) {
  let dateTransformMethod = 'toStartOfHour';
  const timeSpanData = TIME_SPAN_DATA[timeSpan];

  switch (timeSpanData.interval) {
    case 'ten_minutes':
      dateTransformMethod = 'toStartOfTenMinutes';
      break;
    case 'hourly':
      dateTransformMethod = 'toStartOfHour';
      break;
    case 'daily':
      dateTransformMethod = 'toStartOfDay';
      break;
    case 'monthly':
      dateTransformMethod = 'toStartOfMonth';
      break;
  }

  return dateTransformMethod;
}
