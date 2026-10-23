import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { z } from 'zod';
import { logger } from './api-logger';
import type { PublicApiHonoEnv } from '../types';

/**
 * Every machine-readable error code the public API can return in `error.code`.
 * Documented as the enum of the `Error` schema in the OpenAPI spec.
 */
export const API_ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'PLAN_LIMIT_EXCEEDED',
  'NOT_FOUND',
  'USER_NOT_FOUND',
  'FUNNEL_NOT_FOUND',
  'RATE_LIMIT_EXCEEDED',
  'HTTP_ERROR',
  'INTERNAL_ERROR',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export function createErrorBody(code: ApiErrorCode, message: string) {
  return { error: { code, message } };
}

export class ApiError extends HTTPException {
  code: ApiErrorCode;

  constructor(status: ContentfulStatusCode, code: ApiErrorCode, message: string) {
    super(status, { message });
    this.code = code;
  }
}

export function createValidationErrorResponse(issues: z.core.$ZodIssue[]) {
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

export function errorHandler(err: Error, c: Context<PublicApiHonoEnv>) {
  if (err instanceof ApiError) {
    return c.json(createErrorBody(err.code, err.message), err.status);
  }

  if (err instanceof HTTPException) {
    return c.json(createErrorBody('HTTP_ERROR', err.message), err.status);
  }

  const apiKey = c.var.apiKey;
  logger.error(
    {
      method: c.req.method,
      path: c.req.path,
      queryParams: c.req.query(),
      reqContent: c.var.requestContent,
      apiKeyId: apiKey?.id,
      projectId: apiKey?.projectId,
      err,
    },
    'Unhandled public API error',
  );
  return c.json(createErrorBody('INTERNAL_ERROR', 'An unexpected error occurred'), 500);
}
