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

const dateRangeSchema = z
  .union([z.enum(TIME_SPAN_PRESETS), z.tuple([apiDateInputSchema, apiDateInputSchema])])
  .openapi({
    description:
      'Date range for the query. Can be either one of the preset strings below, or an array with two date strings [start, end]. Date strings can be either in YYYY-MM-DD format or UTC ISO-8601 format with second precision.',
    example: ['2026-01-01T12:00:00Z', '2026-01-31T12:00:00Z'],
  });

const aggregateGroupSchema = z.object({}).strict();
const intervalGroupSchema = z.object({ date: apiTimestampSchema }).openapi({
  description: 'Grouping object for time interval queries.',
  example: { date: '2026-01-18T00:00:00Z' },
});
const fieldGroupSchema = z
  .record(fieldGroupByTokenSchema, z.string())
  .refine((value) => Object.keys(value).length === 1, {
    message: 'Grouping object must contain exactly one key',
  })
  .openapi({
    description: 'Grouping object for predefined dimensions (e.g. country, city, browser, referrer).',
    example: { country: 'US' },
  });
const eventPropertyGroupSchema = z
  .record(eventPropertyGroupByTokenSchema, z.string())
  .refine((value) => Object.keys(value).length === 1, {
    message: 'Event property grouping object must contain exactly one key',
  })
  .openapi({
    description: 'Grouping object for event property dimensions.',
    example: { 'event:prop:plan': 'pro' },
  });

const responseMetricsSchema = z
  .object({
    users: z.number().optional().openapi({
      description: 'Unique users count for this row.',
      example: 412,
    }),
    pageviews: z.number().optional().openapi({
      description: 'Pageview events count for this row.',
      example: 1736,
    }),
    events: z.number().optional().openapi({
      description: 'Custom events count for this row.',
      example: 43,
    }),
    bounce_rate: z.number().optional().openapi({
      description: 'Bounce rate percentage for this row.',
      example: 34.12,
    }),
    visit_duration: z.number().optional().openapi({
      description: 'Average visit duration in seconds for this row.',
      example: 1222.45,
    }),
  })
  .refine((value) => Object.values(value).some((metric) => metric !== undefined), {
    message: 'At least one metric value must be present',
  })
  .openapi({
    description: 'Calculated metric values for the row. Only requested metrics are returned.',
  });

export const analyticsQueryRequestSchema = z
  .object({
    date_range: dateRangeSchema,
    metrics: z.array(z.enum(METRICS)).optional().openapi({
      description: `Metrics to calculate and include in the response.`,
      default: DEFAULT_METRICS,
    }),
    group_by: z
      .array(groupByTokenSchema)
      .default([])
      .openapi({
        description:
          'Allowed values: "interval:auto", "country", "city", "browser", "device_type", "os", "referrer", "referrer_type", "utm_*", "event:name", or "event:prop:<property_name>". At the moment it\'s only possible to group by one field, please tell us if you need more.',
        example: ['country'],
      }),
    order_by: orderBySchema.default([]).openapi({
      description: 'Gives you the ability to order multiple fields by different directions',
      example: [['users', 'desc']],
    }),
    limit: z
      .number()
      .int()
      .min(1)
      .max(1000)
      .default(100)
      .openapi({ description: 'Limits the number of returned rows. Max value is 1000.' }),
    offset: z
      .number()
      .int()
      .min(0)
      .default(0)
      .openapi({ description: 'Number of rows to skip from the start of the result set, to implement pagination.' }),
    filters: z
      .array(apiFilterSchema)
      .optional()
      .openapi({
        description: 'Ability to filter the results based on multiple criteria.',
        'x-vemetric-docs': { collapseByDefault: true },
      }),
    filtersOperator: apiFiltersOperatorSchema.default('and').openapi({
      description: 'Operator to apply between multiple filters. Can be either "and" or "or".',
    }),
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
      const isMetric = METRICS_SET.has(field as Metric);
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

export const analyticsQueryResponseSchema = z
  .object({
    period: z
      .object({
        from: apiTimestampSchema.openapi({
          description: 'Resolved UTC start timestamp for the query window.',
        }),
        to: apiTimestampSchema.openapi({
          description: 'Resolved UTC end timestamp for the query window.',
        }),
      })
      .openapi({
        description: 'Resolved query period.',
      }),
    query: z
      .object({
        date_range: dateRangeSchema.openapi({
          description: 'Echo of the incoming `date_range` request field.',
        }),
        group_by: z.array(groupByTokenSchema).max(1).openapi({
          description: 'Echo of the incoming `group_by` request field.',
        }),
        metrics: z.array(z.enum(METRICS)).min(1).openapi({
          description: 'Resolved list of metrics used in the query.',
        }),
        order_by: orderBySchema.openapi({
          description: 'Echo of the incoming `order_by` request field.',
        }),
        limit: z.number().int().min(1).openapi({
          description: 'Echo of the incoming `limit` request field.',
        }),
        offset: z.number().int().min(0).openapi({
          description: 'Echo of the incoming `offset` request field.',
        }),
      })
      .openapi({
        description: 'Resolved query configuration used for this response.',
      }),
    pagination: z
      .object({
        limit: z.number().int().min(1).openapi({
          description: 'Applied row limit after internal normalization.',
        }),
        offset: z.number().int().min(0).openapi({
          description: 'Applied row offset after internal normalization.',
        }),
        returned: z.number().int().min(0).openapi({
          description:
            'Number of rows returned in `data`. Can be used to determine if there are more rows available for pagination (when `returned` is equal to `limit`, there might be more rows available on the next page).',
        }),
      })
      .openapi({
        description: 'Pagination metadata for the response.',
      }),
    data: z
      .array(
        z
          .object({
            group: z
              .union([aggregateGroupSchema, intervalGroupSchema, fieldGroupSchema, eventPropertyGroupSchema])
              .openapi({
                description: 'Group values for this row. Empty object for aggregate queries.',
              }),
            metrics: responseMetricsSchema,
          })
          .openapi({
            description: 'One grouped analytics row.',
          }),
      )
      .openapi({
        description: 'Result rows for the query after grouping, sorting, and pagination.',
      }),
  })
  .openapi({
    description: 'Analytics query response.',
    example: {
      period: {
        from: '2026-01-18T00:00:00Z',
        to: '2026-01-19T23:59:59Z',
      },
      query: {
        date_range: '30days',
        group_by: ['country'],
        metrics: ['users', 'events'],
        order_by: [['users', 'desc']],
        limit: 100,
        offset: 0,
      },
      pagination: {
        limit: 100,
        offset: 0,
        returned: 2,
      },
      data: [
        {
          group: { country: 'US' },
          metrics: { users: 7, events: 43 },
        },
      ],
    },
  });
