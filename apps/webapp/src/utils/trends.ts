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
