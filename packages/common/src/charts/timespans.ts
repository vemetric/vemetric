export type TimeSpan = 'live' | '1hr' | '24hrs' | '7days' | '30days' | '3months' | '6months' | '1year' | 'custom';
export type ChartInterval = 'thirty_seconds' | 'ten_minutes' | 'hourly' | 'daily' | 'weekly' | 'monthly';
export type TimeSpanDateValue = { day: number; month: number; year: number };

export const formatTimeSpanDateValue = (value: TimeSpanDateValue): string => {
  const month = value.month.toString().padStart(2, '0');
  const day = value.day.toString().padStart(2, '0');
  return `${value.year}-${month}-${day}`;
};
export const parseTimeSpanDateValue = (dateString: string): TimeSpanDateValue => {
  const [year, month, day] = dateString.split('-').map(Number);
  return { year, month, day };
};

export const TIME_SPANS: readonly [TimeSpan, ...TimeSpan[]] = [
  'live',
  '1hr',
  '24hrs',
  '7days',
  '30days',
  '3months',
  '6months',
  '1year',
  'custom',
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
  custom: { label: 'Custom', interval: 'daily' },
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

export const getCustomDateRangeInterval = (startDate: Date, endDate: Date): ChartInterval => {
  const diffInMs = endDate.getTime() - startDate.getTime();
  const diffInDays = Math.round(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInDays <= 2) return 'hourly';
  if (diffInDays <= 31) return 'daily';
  if (diffInDays <= 90) return 'weekly';
  return 'monthly';
};

export const timeSpanRangeMin = new Date(2010, 0, 1); // January 1, 2010
const now = new Date();
export const getTimeSpanRangeMax = () => new Date(now.getFullYear(), now.getMonth() + 1, 0); // End of current month
