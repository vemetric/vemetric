import type { TimeSpan } from '@vemetric/common/charts/timespans';
import { z } from 'zod';

export const periodSchema = z.enum(['24h', '7d', '30d', '3m', '6m', '1y']).default('7d');

export const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export const dateRangeSchema = z.object({
  period: periodSchema.optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
});

export const statsQuerySchema = dateRangeSchema.merge(paginationSchema);

export const timeseriesQuerySchema = dateRangeSchema.extend({
  metrics: z.enum(['pageviews', 'users', 'sessions', 'bounce_rate', 'duration']).array().optional(),
  interval: z.enum(['hour', 'day', 'week', 'month']).optional(),
});

export const sourceTypeSchema = z.enum([
  'referrer',
  'referrerUrl',
  'referrerType',
  'utmCampaign',
  'utmContent',
  'utmMedium',
  'utmSource',
  'utmTerm',
]);

export const sourcesQuerySchema = statsQuerySchema.extend({
  source: sourceTypeSchema.default('referrer'),
});

export const userIdParamSchema = z.object({
  userId: z.string(),
});

export const funnelIdParamSchema = z.object({
  funnelId: z.string().uuid(),
});

export const eventNameParamSchema = z.object({
  eventName: z.string(),
});

export const pagePathParamSchema = z.object({
  path: z.string(),
});

export function getPeriodDates(
  period?: string,
  startDate?: string,
  endDate?: string,
): { start: Date; end: Date } {
  const now = new Date();
  let start: Date;
  const end: Date = endDate ? new Date(endDate) : now;

  if (startDate) {
    start = new Date(startDate);
  } else {
    switch (period) {
      case '24h':
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '3m':
        start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '6m':
        start = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
  }

  return { start, end };
}

export function getTimeSpanFromPeriod(period?: string): TimeSpan {
  switch (period) {
    case '24h':
      return '24hrs';
    case '7d':
      return '7days';
    case '30d':
      return '30days';
    case '3m':
      return '3months';
    case '6m':
      return '6months';
    case '1y':
      return '1year';
    default:
      return '7days';
  }
}

export function getIntervalFromPeriod(period?: string): string {
  switch (period) {
    case '24h':
      return 'hourly';
    case '7d':
      return 'daily';
    case '30d':
      return 'daily';
    case '3m':
      return 'weekly';
    case '6m':
      return 'weekly';
    case '1y':
      return 'monthly';
    default:
      return 'daily';
  }
}
