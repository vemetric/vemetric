import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { logger } from '../../utils/logger';

export class ApiError extends HTTPException {
  public code: string;

  constructor(status: number, code: string, message: string) {
    super(status as any, { message });
    this.code = code;
  }
}

export function errorHandler(err: Error, c: Context) {
  if (err instanceof ApiError) {
    return c.json({ error: { code: err.code, message: err.message } }, err.status as any);
  }

  if (err instanceof HTTPException) {
    return c.json({ error: { code: 'ERROR', message: err.message } }, err.status as any);
  }

  logger.error({ err }, 'Unhandled API error');
  return c.json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } }, 500);
}
