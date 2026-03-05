import { z } from '@hono/zod-openapi';
import { TIME_SPAN_PRESETS } from '@vemetric/common/charts/timespans';

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

export const apiDateRangeSchema = z
  .union([z.enum(TIME_SPAN_PRESETS), z.tuple([apiDateInputSchema, apiDateInputSchema])])
  .openapi({
    description:
      'Can be either one of the preset strings below, or an array with two date strings [start, end]. Date strings can be either in YYYY-MM-DD format or UTC ISO-8601 format with second precision.',
    example: ['2026-01-01T12:00:00Z', '2026-01-31T12:00:00Z'],
  });

export const authorizationHeaderSchema = z
  .object({
    authorization: z.string().openapi({
      description: 'Bearer token for a project API key. This endpoint returns data for that project only.',
      example: 'Bearer vem_abcdefghijklmnopqrstuvwxyz123456',
    }),
  })
  .openapi({
    description: 'Authorization headers for public API requests.',
  });

const getJsonErrorResponseContent = <T extends z.ZodLiteral<string>>(codeType: T) => ({
  'application/json': {
    schema: z
      .object({
        error: z
          .object({
            code: codeType.openapi({
              description: 'Machine-readable error code.',
            }),
            message: z.string().openapi({
              description: 'Human-readable error message.',
            }),
          })
          .openapi({
            description: 'Error details.',
          }),
      })
      .openapi({
        description: 'Error response payload.',
      }),
  },
});

const jsonValidationErrorResponseContent = {
  'application/json': {
    schema: z
      .object({
        error: z
          .object({
            code: z.literal('VALIDATION_ERROR').openapi({
              description: 'Machine-readable validation error code.',
            }),
            message: z.string().openapi({
              description: 'Human-readable validation summary.',
            }),
            details: z
              .array(
                z.object({
                  field: z.string().openapi({
                    description: 'Path to the invalid request field.',
                    example: 'group_by.0',
                  }),
                  message: z.string().openapi({
                    description: 'Validation error message for the field.',
                  }),
                }),
              )
              .openapi({
                description: 'Per-field validation issues.',
              }),
          })
          .openapi({
            description: 'Validation error details.',
          }),
      })
      .openapi({
        description: 'Validation error response payload.',
      }),
  },
} as const;

export const commonOpenApiErrorResponses = {
  400: {
    description: 'Bad request - invalid request payload or parameters',
    content: jsonValidationErrorResponseContent,
  },
  401: {
    description: 'Unauthorized - invalid or revoked API key',
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
