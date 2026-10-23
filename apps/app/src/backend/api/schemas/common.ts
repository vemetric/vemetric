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
