import { z } from '@hono/zod-openapi';
import { filterGroupOperatorsSchema, listFilterSchema, stringFilterSchema } from '@vemetric/common/filters';

const pageApiFilterSchema = z.object({
  type: z.literal('page'),
  origin: stringFilterSchema.optional(),
  path: stringFilterSchema.optional(),
  hash: stringFilterSchema.optional(),
});

const eventApiFilterSchema = z.object({
  type: z.literal('event'),
  name: stringFilterSchema.optional(),
  properties: z
    .array(
      z
        .object({
          property: z.string(),
        })
        .extend(stringFilterSchema.shape),
    )
    .optional(),
});

const userApiFilterSchema = z.object({
  type: z.literal('user'),
  anonymous: z.boolean(),
});

const locationApiFilterSchema = z.object({
  type: z.literal('location'),
  country: listFilterSchema.optional(),
  city: listFilterSchema.optional(),
});

const referrerApiFilterSchema = z
  .object({
    type: z.literal('referrer'),
  })
  .extend(stringFilterSchema.shape);

const referrerUrlApiFilterSchema = z
  .object({
    type: z.literal('referrer_url'),
  })
  .extend(stringFilterSchema.shape);

const referrerTypeApiFilterSchema = z
  .object({
    type: z.literal('referrer_type'),
  })
  .extend(listFilterSchema.shape);

const utmTagsApiFilterSchema = z.object({
  type: z.literal('utm_tags'),
  utm_campaign: stringFilterSchema.optional(),
  utm_content: stringFilterSchema.optional(),
  utm_medium: stringFilterSchema.optional(),
  utm_source: stringFilterSchema.optional(),
  utm_term: stringFilterSchema.optional(),
});

const browserApiFilterSchema = z
  .object({
    type: z.literal('browser'),
  })
  .extend(listFilterSchema.shape);

const deviceApiFilterSchema = z
  .object({
    type: z.literal('device'),
  })
  .extend(listFilterSchema.shape);

const osApiFilterSchema = z
  .object({
    type: z.literal('os'),
  })
  .extend(listFilterSchema.shape);

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
