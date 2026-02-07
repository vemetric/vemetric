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

const jsonErrorResponseContent = {
  'application/json': {
    schema: errorResponseSchema,
  },
} as const;

const jsonValidationErrorResponseContent = {
  'application/json': {
    schema: validationErrorResponseSchema,
  },
} as const;

export const commonOpenApiErrorResponses = {
  401: {
    description: 'Unauthorized - missing, malformed, invalid, or revoked API key',
    content: jsonErrorResponseContent,
  },
  422: {
    description: 'Validation error',
    content: jsonValidationErrorResponseContent,
  },
  429: {
    description: 'Rate limit exceeded',
    content: jsonErrorResponseContent,
  },
  500: {
    description: 'Unexpected internal error',
    content: jsonErrorResponseContent,
  },
} as const;
