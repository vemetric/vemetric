import type { ChartInterval, TimeSpan } from '@vemetric/common/charts/timespans';
import { getCustomDateRangeInterval, TIME_SPAN_DATA } from '@vemetric/common/charts/timespans';
import { dateTimeFormatter } from '@/utils/date-time-formatter';
import type { DashboardData } from '@/utils/trpc';

// ========================================================== //
// ==================== Helper Functions ==================== //
// ========================================================== //
export const getTimespanInterval = (timespan: TimeSpan, _startDate?: string, _endDate?: string) => {
  const timeSpanData = TIME_SPAN_DATA[timespan];
  if (timespan === 'custom' && _startDate) {
    const startDate = new Date(_startDate + 'T00:00:00Z');
    const endDate = _endDate ? new Date(_endDate + 'T23:59:59Z') : new Date(_startDate + 'T23:59:59Z');
    return getCustomDateRangeInterval(startDate, endDate);
  }
  return timeSpanData.interval;
};

export const getYAxisDomain = (autoMinValue: boolean, minValue?: number | undefined, maxValue?: number | undefined) => {
  const minDomain = autoMinValue ? 'auto' : minValue ?? 0;
  const maxDomain = maxValue ?? 'auto';
  return [minDomain, maxDomain];
};

export function transformChartSeries(
  data: DashboardData['chartTimeSeries'] | null | undefined,
  interval: ChartInterval,
  timespan: TimeSpan,
) {
  // Simple "split into two series" approach:
  // For each metric we create two keys:
  //   - <metric>           => holds the value for completed intervals (solid line)
  //   - <metric>__dashed   => holds the value for incomplete/future intervals (dashed line)
  // This keeps the original time buckets but splits values so the chart can render a
  // solid and a dashed series independently.
  return data?.map((entry) => {
    const startDate = new Date(entry.date);
    const endDate = new Date(startDate);

    let formatMethod: keyof typeof dateTimeFormatter = 'formatTime';
    switch (interval) {
      case 'thirty_seconds':
        formatMethod = 'formatTimeWithSeconds';
        endDate.setSeconds(startDate.getSeconds() + 29);
        break;
      case 'ten_minutes':
        endDate.setMinutes(startDate.getMinutes() + 9);
        break;
      case 'hourly':
        endDate.setMinutes(startDate.getMinutes() + 59);
        break;
      case 'daily':
        formatMethod = 'formatDate';
        endDate.setHours(startDate.getHours() + 23);
        break;
      case 'weekly':
        formatMethod = 'formatWeek';
        endDate.setDate(startDate.getDate() + 6);
        break;
      case 'monthly': {
        if (timespan === '1year') {
          formatMethod = 'formatMonthYear';
        } else {
          formatMethod = 'formatMonth';
        }
        endDate.setDate(startDate.getDate() + 30);
        break;
      }
    }

    // Determine whether this interval is "complete" (in the past) or still running / future.
    // We treat the interval as complete only when its end date is <= now.
    const now = new Date();
    const isComplete = endDate.getTime() <= now.getTime();

    // Ensure we always have numbers (fallback to 0)
    const users = entry.users ?? 0;
    const pageViews = entry.pageViews ?? 0;
    const bounceRate = entry.bounceRate ?? 0;
    const visitDuration = entry.visitDuration ?? 0;
    const events = entry.events ?? 0;

    const base = {
      startDate: dateTimeFormatter[formatMethod](startDate),
      endDate: dateTimeFormatter[formatMethod](endDate),
    } as any;

    // For each metric place value either in the solid key (complete intervals)
    // or in the dashed key (incomplete / future intervals).
    if (isComplete) {
      base.users = users;
      base.users__dashed = 0;

      base.pageViews = pageViews;
      base.pageViews__dashed = 0;

      base.bounceRate = bounceRate;
      base.bounceRate__dashed = 0;

      base.visitDuration = visitDuration;
      base.visitDuration__dashed = 0;

      base.events = events;
      base.events__dashed = 0;
    } else {
      base.users = 0;
      base.users__dashed = users;

      base.pageViews = 0;
      base.pageViews__dashed = pageViews;

      base.bounceRate = 0;
      base.bounceRate__dashed = bounceRate;

      base.visitDuration = 0;
      base.visitDuration__dashed = visitDuration;

      base.events = 0;
      base.events__dashed = events;
    }

    return base;
  });
}