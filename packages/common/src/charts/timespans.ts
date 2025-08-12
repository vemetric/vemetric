export type TimeSpan = 'live' | '1hr' | '24hrs' | '7days' | '30days' | '3months' | '6months' | '1year';
export type ChartInterval = 'thirty_seconds' | 'ten_minutes' | 'hourly' | 'daily' | 'weekly' | 'monthly';

export const TIME_SPANS: readonly [TimeSpan, ...TimeSpan[]] = [
  'live',
  '1hr',
  '24hrs',
  '7days',
  '30days',
  '3months',
  '6months',
  '1year',
];
export const TIME_SPAN_DATA: Record<TimeSpan, { label: string; interval: ChartInterval }> = {
  live: { label: 'Live', interval: 'thirty_seconds' },
  '1hr': { label: 'Last hour', interval: 'ten_minutes' },
  '24hrs': { label: 'Last 24 hours', interval: 'hourly' },
  '7days': { label: 'Last 7 days', interval: 'daily' },
  '30days': { label: 'Last 30 days', interval: 'daily' },
  '3months': { label: 'Last 3 months', interval: 'weekly' },
  '6months': { label: 'Last 6 months', interval: 'monthly' },
  '1year': { label: 'Last year', interval: 'monthly' },
};

export const isTimespanAllowed = (timespan: TimeSpan, isSubscriptionActive: boolean) => {
  if (timespan === '3months' || timespan === '6months' || timespan === '1year') return isSubscriptionActive;

  return true;
};

export const getTimespanRefetchInterval = (timespan: TimeSpan): number | false => {
  switch (timespan) {
    case 'live':
      return 5000; // 5 seconds
    default:
      return false; // No refetch for other timespans
  }
};
