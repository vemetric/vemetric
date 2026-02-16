import { z } from '@hono/zod-openapi';

const getJsonErrorResponseContent = <T extends z.ZodLiteral<string>>(codeType: T) => ({
  'application/json': {
    schema: z.object({
      error: z.object({
        code: codeType,
        message: z.string(),
      }),
    }),
  },
});

const jsonValidationErrorResponseContent = {
  'application/json': {
    schema: z.object({
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
    }),
  },
} as const;

export const commonOpenApiErrorResponses = {
  401: {
    description: 'Unauthorized - missing, malformed, invalid, or revoked API key',
    content: getJsonErrorResponseContent(z.literal('UNAUTHORIZED')),
  },
  422: {
    description: 'Validation error',
    content: jsonValidationErrorResponseContent,
  },
  429: {
    description: 'Rate limit exceeded',
    content: getJsonErrorResponseContent(z.literal('RATE_LIMIT_EXCEEDED')),
  },
  500: {
    description: 'Unexpected internal error',
    content: getJsonErrorResponseContent(z.literal('INTERNAL_SERVER_ERROR')),
  },
} as const;
