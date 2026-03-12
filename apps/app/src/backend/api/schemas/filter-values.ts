import { z } from '@hono/zod-openapi';
import { metricsGroupFieldTokens } from 'clickhouse';
import { apiDateRangeSchema, apiTimestampSchema } from './common';

export const filterValuesFieldSchema = z.enum(metricsGroupFieldTokens).openapi({
  description: 'Field token to retrieve filter values for.',
  example: 'referrer',
});

export const filterValuesRequestSchema = z
  .object({
    dateRange: apiDateRangeSchema,
    fields: z
      .array(filterValuesFieldSchema)
      .min(1, 'fields must include at least one item')
      .max(25, 'fields can include max 25 items')
      .openapi({
        description: 'Field tokens to retrieve values for.',
        example: ['referrer', 'country', 'event:name'],
      }),
    limit: z
      .number()
      .int()
      .min(1)
      .max(1000)
      .default(100)
      .openapi({
        description: 'Limits the number of returned values per field.',
      }),
    offset: z
      .number()
      .int()
      .min(0)
      .default(0)
      .openapi({
        description: 'Number of values to skip per field from the start of the result set.',
      }),
  })
  .superRefine((data, ctx) => {
    if (new Set(data.fields).size !== data.fields.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fields'],
        message: 'fields must not contain duplicates',
      });
    }

    if (Array.isArray(data.dateRange)) {
      const [rawStart, rawEnd] = data.dateRange;
      const start = new Date(rawStart);
      const end = new Date(rawEnd);

      if (start.getTime() > end.getTime()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dateRange'],
          message: 'Start date must be before or equal to end date',
        });
      }
    }
  })
  .openapi({
    description: 'Request payload for retrieving available filter values per field.',
  });

const filterValuesFieldResultSchema = z.object({
  field: filterValuesFieldSchema.openapi({
    description: 'Field token this value list belongs to.',
  }),
  pagination: z.object({
    limit: z.number().int().min(1).openapi({
      description: 'Applied page size for this field.',
    }),
    offset: z.number().int().min(0).openapi({
      description: 'Applied page offset for this field.',
    }),
    returned: z.number().int().min(0).openapi({
      description: 'Number of values returned for this field.',
    }),
  }),
  values: z.array(z.string()).openapi({
    description: 'Paginated values for this field.',
    example: ['Google', 'Newsletter', 'Bing'],
  }),
});

export const filterValuesResponseSchema = z
  .object({
    period: z.object({
      from: apiTimestampSchema.openapi({
        description: 'Resolved UTC start timestamp for the query window.',
      }),
      to: apiTimestampSchema.openapi({
        description: 'Resolved UTC end timestamp for the query window.',
      }),
    }),
    query: z.object({
      dateRange: apiDateRangeSchema.openapi({
        description: 'Echo of the incoming `dateRange` request field.',
      }),
      fields: z.array(filterValuesFieldSchema).min(1).openapi({
        description: 'Echo of the incoming `fields` request field.',
      }),
      limit: z.number().int().min(1).openapi({
        description: 'Echo of the incoming `limit` request field.',
      }),
      offset: z.number().int().min(0).openapi({
        description: 'Echo of the incoming `offset` request field.',
      }),
    }),
    data: z.array(filterValuesFieldResultSchema).openapi({
      description: 'One value list per requested field.',
    }),
  })
  .openapi({
    description: 'Filter values query response.',
  });
