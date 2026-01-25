import { useMemo } from 'react';
import { TbTrendingUp, TbTrendingDown, TbArrowNarrowRight } from 'react-icons/tb';

export type TrendDirection = 'up' | 'down' | 'same';

export interface MetricTrend {
  percentage: number;
  direction: TrendDirection;
}

export type TrendsData = {
  users: MetricTrend;
  pageViews: MetricTrend;
  bounceRate: MetricTrend;
  visitDuration: MetricTrend;
};

export function calculateTrend(current: number, previous: number): MetricTrend {
  if (previous === 0 && current === 0) {
    return { percentage: 0, direction: 'same' };
  }
  if (previous === 0) {
    return { percentage: 100, direction: 'up' };
  }
  const percentageChange = ((current - previous) / previous) * 100;
  const roundedPercentage = Math.round(Math.abs(percentageChange));

  if (roundedPercentage === 0) {
    return { percentage: 0, direction: 'same' };
  }

  return {
    percentage: roundedPercentage,
    direction: percentageChange > 0 ? 'up' : 'down',
  };
}

interface TrendsDataParams {
  users: number;
  pageViews: number;
  bounceRate: number;
  visitDuration: number;
}
export function useTrendsData(
  data: TrendsDataParams | undefined,
  previousData: TrendsDataParams | undefined,
): TrendsData | undefined {
  return useMemo(() => {
    if (!data || !previousData) return undefined;
    return {
      users: calculateTrend(data.users, previousData.users),
      pageViews: calculateTrend(data.pageViews, previousData.pageViews),
      bounceRate: calculateTrend(data.bounceRate, previousData.bounceRate),
      visitDuration: calculateTrend(data.visitDuration, previousData.visitDuration),
    };
  }, [data, previousData]);
}

export function getTrendIcon(direction: TrendDirection) {
  switch (direction) {
    case 'up':
      return TbTrendingUp;
    case 'down':
      return TbTrendingDown;
    default:
      return TbArrowNarrowRight;
  }
}

export function getTrendColor(direction: TrendDirection, higherIsBetter: boolean): string {
  if (direction === 'same') {
    return 'gray.500';
  }

  const isPositive = direction === 'up';
  const isGood = higherIsBetter ? isPositive : !isPositive;

  return isGood ? 'green.500' : 'red.500';
}
