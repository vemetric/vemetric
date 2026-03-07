import { z } from '@hono/zod-openapi';
import { eventApiFilterSchema, pageApiFilterSchema, apiFilterSchema, apiFiltersOperatorSchema } from './api-filters';
import { apiDateRangeSchema, apiTimestampSchema } from './common';

export const funnelIdSchema = z.string().openapi({
  description: 'Unique funnel id.',
  example: '550e8400-e29b-41d4-a716-446655440000',
});

const funnelStepIdSchema = z.string().min(3).openapi({
  description: 'Unique funnel step id.',
  example: 'zvpslSIPFJQ6oiRCXPMm3',
});

const funnelStepNameSchema = z.string().openapi({
  description: 'Name of the funnel step.',
  example: 'Visited Landing Page',
});

export const apiFunnelStepSchema = z.object({
  id: funnelStepIdSchema,
  name: funnelStepNameSchema,
  filter: z.union([pageApiFilterSchema, eventApiFilterSchema]).openapi({
    description:
      'Condition that determines when the funnel step is considered completed. Either a pageview or a custom event filter.',
  }),
});

const funnelSchema = z.object({
  id: funnelIdSchema,
  name: z.string().openapi({
    description: 'Funnel name.',
    example: 'Signup Funnel',
  }),
  icon: z.string().nullable().openapi({
    description: 'Optional funnel icon.',
    example: '🚀',
  }),
  steps: z.array(apiFunnelStepSchema).openapi({
    description: 'Ordered funnel steps.',
  }),
  createdAt: z.string().datetime().openapi({
    description: 'Funnel creation timestamp (ISO 8601).',
    example: '2026-03-01T10:00:00.000Z',
  }),
  updatedAt: z.string().datetime().openapi({
    description: 'Funnel last update timestamp (ISO 8601).',
    example: '2026-03-02T11:30:00.000Z',
  }),
});

export const funnelsListResponseSchema = z.object({
  funnels: z.array(funnelSchema).openapi({
    description: 'All available funnels for the authenticated project.',
  }),
});

export const funnelResultsRequestSchema = z
  .object({
    dateRange: apiDateRangeSchema,
    filters: z
      .array(apiFilterSchema)
      .optional()
      .openapi({
        description: 'Optional filters applied before funnel step evaluation.',
        'x-vemetric-docs': { collapseByDefault: true },
      }),
    filtersOperator: apiFiltersOperatorSchema.default('and').openapi({
      description: 'Operator to apply between multiple filters.',
    }),
  })
  .superRefine((data, ctx) => {
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
  });

const funnelResultStepSchema = z.object({
  id: funnelStepIdSchema,
  name: funnelStepNameSchema,
  users: z.number().int().min(0).openapi({
    description: 'Users that reached this step.',
    example: 128,
  }),
  conversionRate: z.number().min(0).max(100).openapi({
    description: 'Step-to-step conversion rate in percent. First step is always 100 (or 0 if empty).',
    example: 65.3,
  }),
});

export const funnelResultsResponseSchema = z.object({
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
      dateRange: apiDateRangeSchema.openapi({
        description: 'Echo of the incoming `dateRange` request field.',
      }),
      filters: z.array(apiFilterSchema).optional().openapi({
        description: 'Echo of the incoming `filters` request field.',
      }),
      filtersOperator: apiFiltersOperatorSchema.optional().openapi({
        description: 'Echo of the incoming `filtersOperator` request field.',
      }),
    })
    .openapi({ description: 'Resolved query configuration used for this response.' }),
  funnel: funnelSchema.openapi({
    description: 'Funnel definition for which these results were computed.',
  }),
  results: z
    .object({
      activeUsers: z.number().int().min(0).openapi({
        description: 'Users active in the period and matching filters.',
        example: 245,
      }),
      steps: z.array(funnelResultStepSchema).openapi({
        description: 'Per-step user counts in funnel order.',
      }),
      conversionRate: z.number().min(0).max(100).openapi({
        description: 'Conversion rate from first funnel step to last funnel step, in percent.',
        example: 32.81,
      }),
      activeUserConversionRate: z.number().min(0).max(100).openapi({
        description: 'Conversion rate from active users to last funnel step, in percent.',
        example: 18.26,
      }),
    })
    .openapi({
      description: 'Funnel results for the given query.',
    }),
});
