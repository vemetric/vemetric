import { z } from '@hono/zod-openapi';
import { apiFiltersOperatorSchema, apiFilterSchema } from './api-filters';
import { apiDateRangeSchema, apiTimestampSchema, checkDateRangeOrder } from './common';

export const eventPropertiesRequestSchema = z
  .object({
    eventNames: z
      .array(z.string().trim().min(1, 'event names must not be empty'))
      .min(1, 'eventNames must include at least one item')
      .max(25, 'eventNames can include max 25 items')
      .openapi({
        description: 'Names of the custom events to list the properties of.',
        example: ['signup', 'purchase'],
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
      description: 'Limits the number of returned properties per event. Max value is 1000.',
    }),
    offset: z.number().int().min(0).default(0).openapi({
      description: 'Number of properties to skip per event from the start of the result set, to implement pagination.',
    }),
  })
  .superRefine((data, ctx) => {
    if (new Set(data.eventNames).size !== data.eventNames.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['eventNames'],
        message: 'eventNames must not contain duplicates',
      });
    }

    checkDateRangeOrder(data.dateRange, ctx);
  })
  .openapi({
    description: 'Request payload for listing the properties of custom events.',
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

const eventPropertiesResultSchema = z.object({
  eventName: z.string().openapi({
    description: 'Event name this property list belongs to.',
    example: 'signup',
  }),
  pagination: z.object({
    limit: z.number().int().min(1).openapi({
      description: 'Applied page size for this event.',
    }),
    offset: z.number().int().min(0).openapi({
      description: 'Applied page offset for this event.',
    }),
    returned: z.number().int().min(0).openapi({
      description: 'Number of properties returned for this event.',
    }),
  }),
  properties: z.array(eventPropertySchema).openapi({
    description:
      'Properties of the event, sorted by the number of events that have them (descending). Empty if the event has no properties in the period.',
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
      eventNames: z.array(z.string()).openapi({
        description: 'Echo of the incoming `eventNames` request field.',
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
    data: z.array(eventPropertiesResultSchema).openapi({
      description: 'One property list per requested event, in the order of `eventNames`.',
    }),
  })
  .openapi({
    description: 'Event properties response.',
  });
