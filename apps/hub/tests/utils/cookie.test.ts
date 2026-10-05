import { Hono } from 'hono';
import { describe, it, expect } from 'vitest';
import type { HonoContext } from '../../src/types';
import { getUserIdFromCookie } from '../../src/utils/cookie';

const app = new Hono();
app.get('/', (context) => context.text(String(getUserIdFromCookie(context as unknown as HonoContext))));

async function readUserIdWithCookie(cookie?: string) {
  const response = await app.request('/', { headers: cookie ? { cookie } : {} });
  return await response.text();
}

describe('getUserIdFromCookie', () => {
  it('should return the userId from the cookie', async () => {
    expect(await readUserIdWithCookie('_vuid=123456789')).toBe('123456789');
  });

  it('should return null if there is no cookie', async () => {
    expect(await readUserIdWithCookie()).toBe('null');
    expect(await readUserIdWithCookie('_vuid=')).toBe('null');
  });

  it('should return null if the cookie is not a valid userId', async () => {
    expect(await readUserIdWithCookie('_vuid=abc')).toBe('null');
  });
});
