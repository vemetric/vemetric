import { z } from '@hono/zod-openapi';
import { sortDirectionSchema } from '@vemetric/common/sort';
import { apiFilterSchema, apiFiltersOperatorSchema, eventApiFilterSchema } from './api-filters';
import { apiDateRangeSchema, apiTimestampSchema } from './common';

const usersOrderByFieldSchema = z.enum(['last_seen_at', 'display_name', 'identifier', 'country']).openapi({
  description: 'Sortable user field.',
  example: 'last_seen_at',
});

const usersEventOrderByFieldSchema = z.literal('last_event_fired').openapi({
  description: 'Special sort field that sorts users by when they last fired a matching event filter.',
  example: 'last_event_fired',
});

const usersEventOrderByFilterSchema = eventApiFilterSchema.omit({ type: true }).openapi({
  description: 'Event filter used to determine when a user last fired a matching event.',
});

const usersOrderByItemSchema = z.union([
  z.tuple([usersOrderByFieldSchema, sortDirectionSchema]),
  z.tuple([usersEventOrderByFieldSchema, sortDirectionSchema, usersEventOrderByFilterSchema]),
]);

const usersOrderBySchema = z
  .array(usersOrderByItemSchema)
  .max(1, 'order_by can include max one item')
  .openapi({
    description:
      "Gives you the ability to order users by a specific field and direction. At the moment it's only possible to order by one field.",
    default: [['last_seen_at', 'desc']],
    'x-vemetric-docs': {
      hideTupleVariantChildren: true,
    },
    example: [
      [
        'last_event_fired',
        'desc',
        {
          name: { operator: 'eq', value: 'Signup' },
          properties: [{ property: 'provider', operator: 'eq', value: 'google' }],
        },
      ],
    ],
  });

export const userListItemSchema = z
  .object({
    id: z.string().openapi({
      description: "Vemetric's internal user ID.",
      example: '123',
    }),
    identifier: z.string().nullable().openapi({
      description: 'User identifier if available (the value you provided to identify the user).',
      example: 'john@example.com',
    }),
    display_name: z.string().nullable().openapi({
      description: 'User display name if available.',
      example: 'John Doe',
    }),
    country: z.string().nullable().openapi({
      description: 'ISO-3166 alpha-2 country code, or `null` when unknown.',
      example: 'US',
    }),
    city: z.string().nullable().openapi({
      description: 'User city, or `null` when unknown.',
      example: 'Berlin',
    }),
    last_seen_at: apiTimestampSchema.nullable().openapi({
      description: 'UTC timestamp of the latest activity for this user within the selected period.',
    }),
    last_event_fired_at: apiTimestampSchema.nullable().openapi({
      description:
        'UTC timestamp of when the user last fired the event referenced by `order_by[0][2]`. Populated only for `order_by[0][0] = "last_event_fired"`, otherwise `null`.',
    }),
    avatar_url: z.string().nullable().openapi({
      description: 'Avatar URL if available.',
      example: 'https://cdn.example.com/avatar.png',
    }),
    anonymous: z.boolean().openapi({
      description: 'Whether the user is anonymous (not identified).',
      example: false,
    }),
  })
  .openapi({
    description: 'Compact summary user row.',
  });

export const userSingleQuerySchema = z
  .object({
    id: z.string().regex(/^\d+$/, 'id must be a numeric user id').optional().openapi({
      description: "Vemetric's internal user ID. You have to either provide `id` or `identifier`.",
      example: '123',
    }),
    identifier: z.string().min(1).optional().openapi({
      description: 'User identifier value. You have to either provide `identifier` or `id`.',
      example: 'your-user-id',
    }),
  })
  .superRefine((data, ctx) => {
    const hasId = typeof data.id === 'string';
    const hasIdentifier = typeof data.identifier === 'string';

    if (hasId === hasIdentifier) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['id'],
        message: 'Provide exactly one of id or identifier',
      });
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['identifier'],
        message: 'Provide exactly one of id or identifier',
      });
    }
  })
  .openapi({
    description: 'Query parameters for fetching one user. Exactly one of `id` or `identifier` is required.',
  });

export const usersListRequestSchema = z
  .object({
    date_range: apiDateRangeSchema.optional(),
    filters: z
      .array(apiFilterSchema)
      .optional()
      .openapi({
        description: 'Optional filters to restrict the user list.',
        'x-vemetric-docs': { collapseByDefault: true },
      }),
    filters_operator: apiFiltersOperatorSchema.default('and').openapi({
      description: 'Operator to apply between multiple filters.',
    }),
    order_by: usersOrderBySchema.optional(),
    limit: z
      .number()
      .int()
      .min(1)
      .max(1000)
      .default(100)
      .openapi({ description: 'Limits the number of returned users. Max value is 1000.' }),
    offset: z
      .number()
      .int()
      .min(0)
      .default(0)
      .openapi({ description: 'Number of users to skip from the start of the result set.' }),
  })
  .superRefine((data, ctx) => {
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
  })
  .openapi({
    description: 'Request payload for querying a paginated list of users.',
  });

export type UsersListRequest = z.infer<typeof usersListRequestSchema>;

export const usersListResponseSchema = z
  .object({
    period: z
      .object({
        from: apiTimestampSchema.openapi({
          description: 'Resolved UTC start timestamp for the user list query window.',
        }),
        to: apiTimestampSchema.openapi({
          description: 'Resolved UTC end timestamp for the user list query window.',
        }),
      })
      .openapi({
        description: 'Resolved query period.',
      }),
    pagination: z
      .object({
        limit: z.number().int().min(1).openapi({
          description: 'Applied row limit.',
        }),
        offset: z.number().int().min(0).openapi({
          description: 'Applied row offset.',
        }),
        returned: z.number().int().min(0).openapi({
          description: 'Number of user rows returned in `users`.',
        }),
      })
      .openapi({
        description: 'Pagination metadata.',
      }),
    users: z.array(userListItemSchema).openapi({
      description: 'List of user rows for the current page.',
    }),
  })
  .openapi({
    description: 'Successful users list response payload.',
  });

export const usersSingleResponseSchema = z
  .object({
    user: userListItemSchema
      .omit({
        last_event_fired_at: true,
      })
      .openapi({
        description: 'Resolved user row.',
      }),
  })
  .openapi({
    description: 'Successful single user response payload.',
  });
