import { z } from '@hono/zod-openapi';
import { apiFiltersOperatorSchema, apiFilterSchema } from './api-filters';
import { apiDateRangeSchema, apiTimestampSchema } from './common';

export const eventPropertiesRequestSchema = z
  .object({
    eventName: z.string().trim().min(1, 'eventName must not be empty').openapi({
      description: 'Name of the custom event to list the properties of.',
      example: 'signup',
    }),
    dateRange: apiDateRangeSchema,
    filters: z
      .array(apiFilterSchema)
      .optional()
      .openapi({
        description: 'Optional filters to only count events matching them.',
        'x-vemetric-docs': { collapseByDefault: true },
      }),
    filtersOperator: apiFiltersOperatorSchema.default('and').openapi({
      description: 'Operator to apply between multiple filters.',
    }),
    limit: z.number().int().min(1).max(1000).default(100).openapi({
      description: 'Limits the number of returned properties. Max value is 1000.',
    }),
    offset: z.number().int().min(0).default(0).openapi({
      description: 'Number of properties to skip from the start of the result set, to implement pagination.',
    }),
  })
  .superRefine((data, ctx) => {
    if (Array.isArray(data.dateRange)) {
      const [rawStart, rawEnd] = data.dateRange;
      const start = new Date(rawStart);
      const end = new Date(rawEnd);

      if (start.getTime() > end.getTime()) {
        ctx.addIssue({
          code: 'custom',
          path: ['dateRange'],
          message: 'Start date must be before or equal to end date',
        });
      }
    }
  })
  .openapi({
    description: 'Request payload for listing the properties of a custom event.',
  });

const eventPropertySchema = z.object({
  name: z.string().openapi({
    description: 'Property name. Group or filter by it with the `event:prop:<name>` token.',
    example: 'plan',
  }),
  events: z.number().int().min(0).openapi({
    description: 'Number of events in the period that have this property.',
    example: 312,
  }),
  users: z.number().int().min(0).openapi({
    description: 'Number of unique users that sent an event with this property.',
    example: 280,
  }),
});

export const eventPropertiesResponseSchema = z
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
      eventName: z.string().openapi({
        description: 'Echo of the incoming `eventName` request field.',
      }),
      dateRange: apiDateRangeSchema.openapi({
        description: 'Echo of the incoming `dateRange` request field.',
      }),
      filters: z.array(apiFilterSchema).optional().openapi({
        description: 'Echo of the incoming `filters` request field.',
      }),
      filtersOperator: apiFiltersOperatorSchema.optional().openapi({
        description: 'Echo of the incoming `filtersOperator` request field.',
      }),
      limit: z.number().int().min(1).openapi({
        description: 'Echo of the incoming `limit` request field.',
      }),
      offset: z.number().int().min(0).openapi({
        description: 'Echo of the incoming `offset` request field.',
      }),
    }),
    pagination: z.object({
      limit: z.number().int().min(1).openapi({
        description: 'Applied page size.',
      }),
      offset: z.number().int().min(0).openapi({
        description: 'Applied page offset.',
      }),
      returned: z.number().int().min(0).openapi({
        description: 'Number of properties returned.',
      }),
    }),
    properties: z.array(eventPropertySchema).openapi({
      description: 'Properties of the event, sorted by the number of events that have them (descending).',
    }),
  })
  .openapi({
    description: 'Event properties response.',
  });
