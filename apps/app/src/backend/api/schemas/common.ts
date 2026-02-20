import { z } from '@hono/zod-openapi';

export const utcDateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;
const apiTimestampRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

export const apiTimestampSchema = z
  .string()
  .regex(apiTimestampRegex, 'Timestamp must be UTC ISO-8601 with second precision')
  .openapi({
    description: 'UTC timestamp in ISO-8601 format with second precision (no milliseconds).',
    example: '2026-01-19T12:30:00Z',
    pattern: apiTimestampRegex.source,
  });

export const apiDateInputSchema = z
  .string()
  .refine(
    (value) => utcDateOnlyRegex.test(value) || apiTimestampRegex.test(value),
    'UTC date input must be either YYYY-MM-DD or UTC ISO-8601 with second precision',
  )
  .openapi({
    description: 'Either YYYY-MM-DD or UTC ISO-8601 format with second precision (no milliseconds).',
    example: '2026-01-19|2026-01-19T12:30:00Z',
  });

export const authorizationHeaderSchema = z.object({
  authorization: z.string().openapi({
    description: 'Bearer token for a project API key. This endpoint returns data for that project only.',
    example: 'Bearer vem_abcdefghijklmnopqrstuvwxyz123456',
  }),
});

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
  400: {
    description: 'Bad request - invalid request payload or parameters',
    content: jsonValidationErrorResponseContent,
  },
  401: {
    description: 'Unauthorized - missing, malformed, invalid, or revoked API key',
    content: getJsonErrorResponseContent(z.literal('UNAUTHORIZED')),
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
