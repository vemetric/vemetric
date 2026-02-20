import { z } from '@hono/zod-openapi';
import { filterGroupOperatorsSchema, listFilterSchema, stringFilterSchema } from '@vemetric/common/filters';

const pageApiFilterSchema = z
  .object({
    type: z.literal('page'),
    origin: stringFilterSchema.optional().openapi({
      description: 'Filter based on the page origin (protocol + host). For example, "https://example.com".',
    }),
    path: stringFilterSchema.optional().openapi({
      description: 'Filter based on the page path. For example, "/blog".',
    }),
    hash: stringFilterSchema.optional().openapi({
      description: 'Filter based on the page hash. For example, "#section1".',
    }),
  })
  .openapi({
    description:
      'Filter based on specific page view properties, like the full URL (origin + path + hash) or its individual parts.',
    example: {
      type: 'page',
      origin: { value: 'https://example.com', operator: 'is' },
      path: { value: '/blog', operator: 'startsWith' },
    },
  });

const eventApiFilterSchema = z
  .object({
    type: z.literal('event').openapi({
      description: 'Filter type identifier for event filters.',
    }),
    name: stringFilterSchema.optional().openapi({
      description: 'Filter by event name.',
    }),
    properties: z
      .array(
        z.object({
          property: z.string().openapi({
            description: 'Event property key inside custom event data.',
            example: 'plan',
          }),
          value: stringFilterSchema.shape.value.openapi({
            description: 'Event property value to compare against.',
            example: 'pro',
          }),
          operator: stringFilterSchema.shape.operator.openapi({
            description: 'String matching operator for `value`.',
            example: 'is',
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
      name: { operator: 'is', value: 'signup' },
      properties: [{ property: 'plan', operator: 'is', value: 'pro' }],
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
    value: stringFilterSchema.shape.value.openapi({
      description: 'Referrer value to match. Empty string represents direct/none referrer.',
      example: 'Google',
    }),
    operator: stringFilterSchema.shape.operator.openapi({
      description: 'String matching operator for `value`.',
      example: 'is',
    }),
  })
  .openapi({
    description: 'Filter by referrer name.',
    example: {
      type: 'referrer',
      operator: 'is',
      value: 'Google',
    },
  });

const referrerUrlApiFilterSchema = z
  .object({
    type: z.literal('referrer_url').openapi({
      description: 'Filter type identifier for referrer URL filters.',
    }),
    value: stringFilterSchema.shape.value.openapi({
      description: 'Referrer URL value to match.',
      example: 'https://google.com',
    }),
    operator: stringFilterSchema.shape.operator.openapi({
      description: 'String matching operator for `value`.',
      example: 'contains',
    }),
  })
  .openapi({
    description: 'Filter by referrer URL.',
    example: {
      type: 'referrer_url',
      operator: 'contains',
      value: 'google.com',
    },
  });

const referrerTypeApiFilterSchema = z
  .object({
    type: z.literal('referrer_type').openapi({
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
      type: 'referrer_type',
      operator: 'oneOf',
      value: ['search'],
    },
  });

const utmTagsApiFilterSchema = z
  .object({
    type: z.literal('utm_tags').openapi({
      description: 'Filter type identifier for UTM tag filters.',
    }),
    utm_campaign: stringFilterSchema.optional().openapi({
      description: 'Filter by UTM campaign.',
    }),
    utm_content: stringFilterSchema.optional().openapi({
      description: 'Filter by UTM content.',
    }),
    utm_medium: stringFilterSchema.optional().openapi({
      description: 'Filter by UTM medium.',
    }),
    utm_source: stringFilterSchema.optional().openapi({
      description: 'Filter by UTM source.',
    }),
    utm_term: stringFilterSchema.optional().openapi({
      description: 'Filter by UTM term.',
    }),
  })
  .openapi({
    description: 'Filter by one or more UTM parameters.',
    example: {
      type: 'utm_tags',
      utm_source: { operator: 'is', value: 'google' },
      utm_medium: { operator: 'is', value: 'cpc' },
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
]);

export const apiFiltersOperatorSchema = filterGroupOperatorsSchema;

export type ApiFilter = z.infer<typeof apiFilterSchema>;
