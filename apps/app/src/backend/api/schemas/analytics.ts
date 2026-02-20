import { z } from '@hono/zod-openapi';
import { TIME_SPAN_PRESETS } from '@vemetric/common/charts/timespans';
import {
  eventPropertyTokenRegex,
  metricsGroupFieldTokens,
  parseMetricsQueryGroupingToken,
} from 'clickhouse/src/utils/query-group';
import { apiFiltersOperatorSchema, apiFilterSchema } from './api-filters';
import { apiDateInputSchema, apiTimestampSchema } from './common';
import type { Metric } from '../consts/analytics';
import { DEFAULT_METRICS, METRICS, METRICS_SET } from '../consts/analytics';
import { isSortingGroupField } from '../utils/analytics/grouping';

const eventPropertyGroupByTokenSchema = z.string().regex(eventPropertyTokenRegex, 'Invalid grouping token').openapi({
  description: 'Group by event property token',
  example: 'event:prop:plan',
  pattern: eventPropertyTokenRegex.source,
});

const fieldGroupByTokenSchema = z.enum(metricsGroupFieldTokens);
const groupByTokenSchema = z.union([
  fieldGroupByTokenSchema,
  z.literal('interval:auto'),
  eventPropertyGroupByTokenSchema,
]);

const orderByPropertyFieldSchema = z.string().regex(eventPropertyTokenRegex, 'Invalid sort field').openapi({
  description: 'Event property sort field token',
  example: 'event:prop:plan',
  pattern: eventPropertyTokenRegex.source,
});

const orderByFieldSchema = z.union([
  z.enum(METRICS),
  fieldGroupByTokenSchema,
  z.literal('date'),
  orderByPropertyFieldSchema,
]);

const orderBySchema = z
  .array(z.tuple([orderByFieldSchema, z.enum(['asc', 'desc'])]))
  .max(1, 'order_by can include max one item in v1');

const dateRangeSchema = z.union([z.enum(TIME_SPAN_PRESETS), z.tuple([apiDateInputSchema, apiDateInputSchema])]);

const aggregateGroupSchema = z.object({}).strict();
const intervalGroupSchema = z.object({ date: apiTimestampSchema });
const fieldGroupSchema = z
  .record(fieldGroupByTokenSchema, z.string())
  .refine((value) => Object.keys(value).length === 1, {
    message: 'Grouping object must contain exactly one key',
  });
const eventPropertyGroupSchema = z
  .record(eventPropertyGroupByTokenSchema, z.string())
  .refine((value) => Object.keys(value).length === 1, {
    message: 'Event property grouping object must contain exactly one key',
  });

const responseMetricsSchema = z
  .object({
    users: z.number().optional(),
    pageviews: z.number().optional(),
    events: z.number().optional(),
    bounce_rate: z.number().optional(),
    visit_duration: z.number().optional(),
  })
  .refine((value) => Object.values(value).some((metric) => metric !== undefined), {
    message: 'At least one metric value must be present',
  });

export const analyticsQueryRequestSchema = z
  .object({
    date_range: dateRangeSchema,
    metrics: z.array(z.enum(METRICS)).optional(),
    group_by: z
      .array(groupByTokenSchema)
      .default([])
      .openapi({
        description:
          'Allowed values: "interval:auto", "country", "city", "browser", "device_type", "os", "referrer", "referrer_type", "utm_*", "event:name", or "event:prop:<property_name>".',
        example: ['country'],
      }),
    order_by: orderBySchema.default([]),
    limit: z.number().int().min(1).max(1000).default(100),
    offset: z.number().int().min(0).default(0),
    filters: z
      .array(apiFilterSchema)
      .optional()
      .openapi({ 'x-vemetric-docs': { collapseByDefault: true } }),
    filtersOperator: apiFiltersOperatorSchema.default('and'),
  })
  .superRefine((data, ctx) => {
    if (data.group_by.length > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['group_by'],
        message: 'group_by can include max one item in v1',
      });
    }

    if (Array.isArray(data.date_range)) {
      const [rawStart, rawEnd] = data.date_range;
      const start = new Date(rawStart);
      const end = new Date(rawEnd);

      if (start.getTime() > end.getTime()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['date_range'],
          message: 'Start date must be before or equal to end date',
        });
      }
    }

    const selectedMetrics = data.metrics && data.metrics.length > 0 ? data.metrics : DEFAULT_METRICS;
    const grouping = parseMetricsQueryGroupingToken(data.group_by[0] ?? null);

    data.order_by.forEach(([field], index) => {
      const isMetric = METRICS_SET.has(field);
      if (isMetric && !selectedMetrics.includes(field as Metric)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['order_by', index, 0],
          message: 'Sort metric must be included in metrics',
        });
      }

      if (!isMetric && !isSortingGroupField(field, grouping)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['order_by', index, 0],
          message: 'Invalid sort field',
        });
      }
    });
  });

export type AnalyticsRequest = z.infer<typeof analyticsQueryRequestSchema>;

export const analyticsQueryResponseSchema = z.object({
  period: z.object({
    from: apiTimestampSchema,
    to: apiTimestampSchema,
  }),
  query: z.object({
    date_range: dateRangeSchema,
    group_by: z.array(groupByTokenSchema).max(1),
    metrics: z.array(z.enum(METRICS)).min(1),
    order_by: orderBySchema,
    limit: z.number().int().min(1),
    offset: z.number().int().min(0),
  }),
  pagination: z.object({
    limit: z.number().int().min(1),
    offset: z.number().int().min(0),
    returned: z.number().int().min(0),
  }),
  data: z.array(
    z.object({
      group: z.union([aggregateGroupSchema, intervalGroupSchema, fieldGroupSchema, eventPropertyGroupSchema]),
      metrics: responseMetricsSchema,
    }),
  ),
});
