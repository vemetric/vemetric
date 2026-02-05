import { z } from '@hono/zod-openapi';

export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export const validationErrorResponseSchema = z.object({
  error: z.object({
    code: z.literal('VALIDATION_ERROR'),
    message: z.string(),
    details: z.array(
      z.object({
        field: z.string(),
        message: z.string(),
      }),
    ),
  }),
});
