import { z } from '@hono/zod-openapi';
import { apiTimestampSchema } from './common';

export const apiEventItemSchema = z
  .object({
    sessionId: z.string().openapi({
      description: 'Session id of the event.',
    }),
    name: z.string().openapi({
      description: 'Event name.',
    }),
    isPageView: z.boolean().openapi({
      description: 'Whether this event is a pageview.',
    }),
    createdAt: apiTimestampSchema.openapi({
      description: 'UTC timestamp when the event was created.',
    }),
    origin: z.string().nullable().openapi({
      description: 'URL origin if available (for pageviews).',
    }),
    path: z.string().nullable().openapi({
      description: 'URL path if available (for pageviews).',
    }),
    hash: z.string().nullable().openapi({
      description: 'URL hash if available (for pageviews).',
    }),
    data: z.record(z.string(), z.any()).openapi({
      description: 'Event data key-value map.',
      example: { plan: 'pro' },
    }),
  })
  .openapi({
    description: 'One event row.',
  });
