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

    return {
      startDate: dateTimeFormatter[formatMethod](startDate),
      endDate: dateTimeFormatter[formatMethod](endDate),
      users: entry.users,
      pageViews: entry.pageViews,
      bounceRate: entry.bounceRate,
      visitDuration: entry.visitDuration,
      events: entry.events,
    };
  });
}
