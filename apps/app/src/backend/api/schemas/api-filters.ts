import { z } from '@hono/zod-openapi';
import { filterGroupOperatorsSchema, listFilterSchema, stringFilterSchema } from '@vemetric/common/filters';

const apiStringOperatorsSchema = z.enum(['any', 'eq', 'notEq', 'contains', 'notContains', 'startsWith', 'endsWith']);
export type ApiStringOperator = z.infer<typeof apiStringOperatorsSchema>;

const apiStringFilterSchema = z.object({
  value: stringFilterSchema.shape.value,
  operator: apiStringOperatorsSchema.openapi({
    description: 'Operator to apply for the string filter. "eq" means equals, "notEq" means not equals.',
  }),
});

export const pageApiFilterSchema = z
  .object({
    type: z.literal('page'),
    origin: apiStringFilterSchema.optional().openapi({
      description: 'Filter based on the page origin (protocol + host). For example, "https://example.com".',
    }),
    path: apiStringFilterSchema.optional().openapi({
      description: 'Filter based on the page path. For example, "/blog".',
    }),
    hash: apiStringFilterSchema.optional().openapi({
      description: 'Filter based on the page hash. For example, "#section1".',
    }),
  })
  .openapi({
    description:
      'Filter based on specific page view properties, like the full URL (origin + path + hash) or its individual parts.',
    example: {
      type: 'page',
      origin: { value: 'https://example.com', operator: 'eq' },
      path: { value: '/blog', operator: 'startsWith' },
    },
  });

export const eventApiFilterSchema = z
  .object({
    type: z.literal('event').openapi({
      description: 'Filter type identifier for event filters.',
    }),
    name: apiStringFilterSchema.optional().openapi({
      description: 'Filter by event name.',
    }),
    properties: z
      .array(
        z.object({
          property: z.string().openapi({
            description: 'Event property key inside custom event data.',
            example: 'provider',
          }),
          value: apiStringFilterSchema.shape.value.openapi({
            description: 'Event property value to compare against.',
            example: 'github',
          }),
          operator: apiStringFilterSchema.shape.operator.openapi({
            description: 'String matching operator for `value`.',
            example: 'eq',
          }),
        }),
      )
      .optional()
      .openapi({
        description: 'Filter by one or more custom event properties.',
      }),
  })
  .openapi({
    description: 'Filter by event name and/or event property values.',
    example: {
      type: 'event',
      name: { operator: 'eq', value: 'signup' },
      properties: [{ property: 'plan', operator: 'eq', value: 'pro' }],
    },
  });

const userApiFilterSchema = z
  .object({
    type: z.literal('user').openapi({
      description: 'Filter type identifier for user filters.',
    }),
    anonymous: z.boolean().openapi({
      description: 'Filter for anonymous (`true`) or identified (`false`) users.',
      example: true,
    }),
  })
  .openapi({
    description:
      'Ability to filter for either anonymous or identified users. This is useful when you want to include only known users (for example, for a retention analysis) or only anonymous users (for example, to analyze new visitor behavior).',
    example: {
      type: 'user',
      anonymous: true,
    },
  });

const locationApiFilterSchema = z
  .object({
    type: z.literal('location').openapi({
      description: 'Filter type identifier for location filters.',
    }),
    country: listFilterSchema.optional().openapi({
      description: 'Filter by one or more country codes (ISO-3166 alpha-2, e.g. "US").',
    }),
    city: listFilterSchema.optional().openapi({
      description: 'Filter by one or more city names.',
      example: {
        value: ['Berlin', 'New York'],
        operator: 'oneOf',
      },
    }),
  })
  .openapi({
    description: 'Filter by geographic location fields.',
    example: {
      type: 'location',
      country: { operator: 'oneOf', value: ['US', 'DE'] },
      city: { operator: 'oneOf', value: ['Berlin'] },
    },
  });

const referrerApiFilterSchema = z
  .object({
    type: z.literal('referrer').openapi({
      description: 'Filter type identifier for referrer filters.',
    }),
    value: apiStringFilterSchema.shape.value.openapi({
      description: 'Referrer value to match. Empty string represents direct/none referrer.',
      example: 'Google',
    }),
    operator: apiStringFilterSchema.shape.operator.openapi({
      description: 'String matching operator for `value`.',
      example: 'eq',
    }),
  })
  .openapi({
    description: 'Filter by referrer name.',
    example: {
      type: 'referrer',
      operator: 'eq',
      value: 'Google',
    },
  });

const referrerUrlApiFilterSchema = z
  .object({
    type: z.literal('referrerUrl').openapi({
      description: 'Filter type identifier for referrer URL filters.',
    }),
    value: apiStringFilterSchema.shape.value.openapi({
      description: 'Referrer URL value to match.',
      example: 'https://google.com',
    }),
    operator: apiStringFilterSchema.shape.operator.openapi({
      description: 'String matching operator for `value`.',
      example: 'contains',
    }),
  })
  .openapi({
    description: 'Filter by referrer URL.',
    example: {
      type: 'referrerUrl',
      operator: 'contains',
      value: 'google.com',
    },
  });

const referrerTypeApiFilterSchema = z
  .object({
    type: z.literal('referrerType').openapi({
      description: 'Filter type identifier for referrer type filters.',
    }),
    value: listFilterSchema.shape.value.openapi({
      description: 'List of referrer types to match (for example: `search`, `social`, `email`, `direct`).',
      example: ['search', 'social'],
    }),
    operator: listFilterSchema.shape.operator.openapi({
      description: 'List matching operator for `value`.',
      example: 'oneOf',
    }),
  })
  .openapi({
    description: 'Filter by referrer category/type.',
    example: {
      type: 'referrerType',
      operator: 'oneOf',
      value: ['search'],
    },
  });

const utmTagsApiFilterSchema = z
  .object({
    type: z.literal('utmTags').openapi({
      description: 'Filter type identifier for UTM tag filters.',
    }),
    utmCampaign: apiStringFilterSchema.optional().openapi({
      description: 'Filter by UTM campaign.',
    }),
    utmContent: apiStringFilterSchema.optional().openapi({
      description: 'Filter by UTM content.',
    }),
    utmMedium: apiStringFilterSchema.optional().openapi({
      description: 'Filter by UTM medium.',
    }),
    utmSource: apiStringFilterSchema.optional().openapi({
      description: 'Filter by UTM source.',
    }),
    utmTerm: apiStringFilterSchema.optional().openapi({
      description: 'Filter by UTM term.',
    }),
  })
  .openapi({
    description: 'Filter by one or more UTM parameters.',
    example: {
      type: 'utmTags',
      utmSource: { operator: 'eq', value: 'google' },
      utmMedium: { operator: 'eq', value: 'cpc' },
    },
  });

const browserApiFilterSchema = z
  .object({
    type: z.literal('browser').openapi({
      description: 'Filter type identifier for browser filters.',
    }),
    value: listFilterSchema.shape.value.openapi({
      description: 'List of browser names to match.',
      example: ['Chrome', 'Safari'],
    }),
    operator: listFilterSchema.shape.operator.openapi({
      description: 'List matching operator for `value`.',
      example: 'oneOf',
    }),
  })
  .openapi({
    description: 'Filter by browser.',
    example: {
      type: 'browser',
      operator: 'oneOf',
      value: ['Chrome'],
    },
  });

const deviceApiFilterSchema = z
  .object({
    type: z.literal('device').openapi({
      description: 'Filter type identifier for device type filters.',
    }),
    value: listFilterSchema.shape.value.openapi({
      description: 'List of device types to match.',
      example: ['desktop', 'mobile'],
    }),
    operator: listFilterSchema.shape.operator.openapi({
      description: 'List matching operator for `value`.',
      example: 'oneOf',
    }),
  })
  .openapi({
    description: 'Filter by device type.',
    example: {
      type: 'device',
      operator: 'oneOf',
      value: ['desktop'],
    },
  });

const osApiFilterSchema = z
  .object({
    type: z.literal('os').openapi({
      description: 'Filter type identifier for operating system filters.',
    }),
    value: listFilterSchema.shape.value.openapi({
      description: 'List of operating system names to match.',
      example: ['macOS', 'Windows'],
    }),
    operator: listFilterSchema.shape.operator.openapi({
      description: 'List matching operator for `value`.',
      example: 'oneOf',
    }),
  })
  .openapi({
    description: 'Filter by operating system.',
    example: {
      type: 'os',
      operator: 'oneOf',
      value: ['macOS'],
    },
  });

const funnelApiFilterSchema = z
  .object({
    type: z.literal('funnel').openapi({
      description: 'Filter type identifier for funnel completion filters.',
    }),
    id: z.string().uuid().openapi({
      description: 'Funnel ID to evaluate for completion status.',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    step: z.number().int().min(0).openapi({
      description: 'Zero-based funnel step index to evaluate.',
      example: 1,
    }),
    operator: z.enum(['completed', 'notCompleted']).openapi({
      description: 'Whether users must have completed or not completed the selected step.',
      example: 'completed',
    }),
  })
  .openapi({
    description: 'Filter users based on funnel step completion.',
    example: {
      type: 'funnel',
      id: '550e8400-e29b-41d4-a716-446655440000',
      step: 1,
      operator: 'completed',
    },
  });

export const apiFilterSchema = z.discriminatedUnion('type', [
  pageApiFilterSchema,
  eventApiFilterSchema,
  userApiFilterSchema,
  locationApiFilterSchema,
  referrerApiFilterSchema,
  referrerUrlApiFilterSchema,
  referrerTypeApiFilterSchema,
  utmTagsApiFilterSchema,
  browserApiFilterSchema,
  deviceApiFilterSchema,
  osApiFilterSchema,
  funnelApiFilterSchema,
]);

export const apiFiltersOperatorSchema = filterGroupOperatorsSchema;

export type ApiFilter = z.infer<typeof apiFilterSchema>;
