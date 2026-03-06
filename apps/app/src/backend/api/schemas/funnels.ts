import { z } from '@hono/zod-openapi';
import { eventApiFilterSchema, pageApiFilterSchema } from './api-filters';

export const apiFunnelStepSchema = z.object({
  id: z.string().min(3).openapi({
    description: 'Unique funnel step id.',
    example: 'zvpslSIPFJQ6oiRCXPMm3',
  }),
  name: z.string().openapi({
    description: 'Name of the funnel step.',
    example: 'Visited Landing Page',
  }),
  filter: z.union([pageApiFilterSchema, eventApiFilterSchema]).openapi({
    description:
      'Condition that determines when the funnel step is considered completed. Either a pageview or a custom event filter.',
  }),
});

const funnelSchema = z.object({
  id: z.string().openapi({
    description: 'Unique funnel identifier.',
    example: '550e8400-e29b-41d4-a716-446655440000',
  }),
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
