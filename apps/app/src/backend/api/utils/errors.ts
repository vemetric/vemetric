import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { ZodIssue } from 'zod';
import { logger } from './api-logger';

export class ApiError extends HTTPException {
  code: string;

  constructor(status: ContentfulStatusCode, code: string, message: string) {
    super(status, { message });
    this.code = code;
  }
}

export function createValidationErrorResponse(issues: ZodIssue[]) {
  return {
    error: {
      code: 'VALIDATION_ERROR' as const,
      message: 'Invalid request parameters',
      details: issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    },
  };
}

export function errorHandler(err: Error, c: Context) {
  if (err instanceof ApiError) {
    return c.json({ error: { code: err.code, message: err.message } }, err.status);
  }

  if (err instanceof HTTPException) {
    return c.json({ error: { code: 'HTTP_ERROR', message: err.message } }, err.status);
  }

  logger.error({ err }, 'Unhandled public API error');
  return c.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    },
    500,
  );
}
