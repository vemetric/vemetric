import { Hono } from 'hono';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HonoContextVars } from '../../src/types';
import { deleteUserIdCookie, getUserIdFromCookie, setUserIdCookie } from '../../src/utils/cookie';
import { hasActiveSession } from '../../src/utils/session';

vi.mock('../../src/utils/session', () => ({
  hasActiveSession: vi.fn(),
}));

const PROJECT_A = BigInt(123);
const PROJECT_B = BigInt(456);

function createApp(projectId: bigint, allowCookies = true, proxyHost?: string) {
  const app = new Hono<{ Variables: HonoContextVars }>();
  app.use('*', async (context, next) => {
    context.set('projectId', projectId);
    context.set('allowCookies', allowCookies);
    context.set('proxyHost', proxyHost);
    await next();
  });
  app.get('/read', async (context) => {
    const userId = await getUserIdFromCookie(context);
    return context.json({ userId: userId === null ? null : String(userId) });
  });
  app.get('/set', (context) => {
    setUserIdCookie(context, BigInt(42));
    return context.text('');
  });
  app.get('/delete', (context) => {
    deleteUserIdCookie(context);
    return context.text('');
  });
  return app;
}

async function getCookieName(projectId: bigint) {
  const response = await createApp(projectId).request('/set');
  return (response.headers.get('set-cookie') ?? '').split('=')[0];
}

async function readUserId(projectId: bigint, cookie: string, allowCookies = true, proxyHost?: string) {
  const response = await createApp(projectId, allowCookies, proxyHost).request('/read', { headers: { cookie } });
  const body = (await response.json()) as { userId: string | null };
  return { userId: body.userId, setCookies: response.headers.getSetCookie() };
}

async function setForProxy(proxyHost: string) {
  const response = await createApp(PROJECT_A, true, proxyHost).request('/set');
  return response.headers.get('set-cookie') ?? '';
}

describe('user id cookie', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets a host-only, partitioned cookie per project', async () => {
    const response = await createApp(PROJECT_A).request('/set');
    const setCookie = response.headers.get('set-cookie') ?? '';

    expect(setCookie).toMatch(/^__Host-vuid_[0-9a-f]{10}=42;/);
    expect(setCookie).toContain('Path=/');
    expect(setCookie).toContain('Max-Age=34128000');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('SameSite=None');
    expect(setCookie).toContain('Partitioned');
    expect(setCookie).not.toContain('Domain');
  });

  it('uses a different cookie name for every project', async () => {
    expect(await getCookieName(PROJECT_A)).not.toBe(await getCookieName(PROJECT_B));
  });

  it("reads the project's own cookie and ignores other projects' cookies", async () => {
    const cookieA = await getCookieName(PROJECT_A);

    expect((await readUserId(PROJECT_A, `${cookieA}=42`)).userId).toBe('42');
    expect((await readUserId(PROJECT_B, `${cookieA}=42`)).userId).toBeNull();
  });

  it('ignores empty and invalid cookie values', async () => {
    const cookieA = await getCookieName(PROJECT_A);

    expect((await readUserId(PROJECT_A, `${cookieA}=`)).userId).toBeNull();
    expect((await readUserId(PROJECT_A, `${cookieA}=abc`)).userId).toBeNull();
  });

  it('prefers the project cookie over the legacy cookie', async () => {
    const cookieA = await getCookieName(PROJECT_A);

    const { userId, setCookies } = await readUserId(PROJECT_A, `${cookieA}=42; _vuid=77`);
    expect(userId).toBe('42');
    expect(setCookies).toEqual([]);
    expect(hasActiveSession).not.toHaveBeenCalled();
  });

  it('takes over the legacy cookie id when it has an active session in this project', async () => {
    vi.mocked(hasActiveSession).mockResolvedValue(true);
    const cookieA = await getCookieName(PROJECT_A);

    const { userId, setCookies } = await readUserId(PROJECT_A, '_vuid=77');
    expect(userId).toBe('77');
    expect(hasActiveSession).toHaveBeenCalledWith(PROJECT_A, BigInt(77));
    expect(setCookies).toHaveLength(1);
    expect(setCookies[0]).toMatch(new RegExp(`^${cookieA}=77;`));
  });

  it('ignores the legacy cookie id without an active session in this project', async () => {
    vi.mocked(hasActiveSession).mockResolvedValue(false);

    const { userId, setCookies } = await readUserId(PROJECT_A, '_vuid=77');
    expect(userId).toBeNull();
    expect(setCookies).toEqual([]);
  });

  it('ignores the legacy cookie when cookies are not allowed', async () => {
    const { userId } = await readUserId(PROJECT_A, '_vuid=77', false);
    expect(userId).toBeNull();
    expect(hasActiveSession).not.toHaveBeenCalled();
  });

  it('sets the cookie on the site domain behind a proxy, so subdomains share it', async () => {
    for (const proxyHost of ['example.com', 'app.example.com', 'hub.example.com']) {
      const setCookie = await setForProxy(proxyHost);
      expect(setCookie).toMatch(/^__Secure-vuid_[0-9a-f]{10}=42;/);
      expect(setCookie).toContain('Domain=example.com');
      expect(setCookie).toContain('Partitioned');
    }
  });

  it('treats private suffixes like vercel.app as their own site', async () => {
    expect(await setForProxy('my-app.vercel.app')).toContain('Domain=my-app.vercel.app');
  });

  it('falls back to a host-only cookie for proxy hosts without a registrable domain', async () => {
    for (const proxyHost of ['localhost:3000', '127.0.0.1:3000']) {
      const setCookie = await setForProxy(proxyHost);
      expect(setCookie).toMatch(/^__Host-vuid_/);
      expect(setCookie).not.toContain('Domain');
    }
  });

  it('prefers the site cookie over the host cookie', async () => {
    const name = (await getCookieName(PROJECT_A)).replace('__Host-', '');

    const { userId } = await readUserId(PROJECT_A, `__Host-${name}=42; __Secure-${name}=43`, true, 'example.com');
    expect(userId).toBe('43');
  });

  it('moves a host cookie to the site domain on a proxied request', async () => {
    const name = (await getCookieName(PROJECT_A)).replace('__Host-', '');

    const { userId, setCookies } = await readUserId(PROJECT_A, `__Host-${name}=42`, true, 'app.example.com');
    expect(userId).toBe('42');
    expect(setCookies.find((cookie) => cookie.startsWith(`__Secure-${name}=42;`))).toContain('Domain=example.com');
    expect(setCookies.find((cookie) => cookie.startsWith(`__Host-${name}=;`))).toContain('Max-Age=0');
  });

  it('deletes the site cookie behind a proxy', async () => {
    const name = (await getCookieName(PROJECT_A)).replace('__Host-', '');
    const response = await createApp(PROJECT_A, true, 'example.com').request('/delete');
    const setCookies = response.headers.getSetCookie();

    expect(setCookies.find((cookie) => cookie.startsWith(`__Secure-${name}=;`))).toContain('Domain=example.com');
    expect(setCookies.find((cookie) => cookie.startsWith(`__Host-${name}=;`))).toContain('Max-Age=0');
  });

  it('deletes the partitioned project cookie', async () => {
    const cookieA = await getCookieName(PROJECT_A);
    const response = await createApp(PROJECT_A).request('/delete');
    const setCookie = response.headers.get('set-cookie') ?? '';

    expect(setCookie).toMatch(new RegExp(`^${cookieA}=;`));
    expect(setCookie).toContain('Max-Age=0');
    expect(setCookie).toContain('Partitioned');
    expect(setCookie).not.toContain('Domain');
  });
});
