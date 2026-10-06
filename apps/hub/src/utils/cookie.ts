import { createHash } from 'node:crypto';
import { getBaseDomain } from '@vemetric/common/env';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { CookieOptions } from 'hono/utils/cookie';
import { getDomain } from 'tldts';
import type { HonoContext } from '../types';
import { hasActiveSession } from './session';

// the old cookie was shared by all projects on the base domain (or the proxy host)
const LEGACY_UID_COOKIE_NAME = '_vuid';
// 13 months
const UID_COOKIE_MAX_AGE_SECONDS = 395 * 24 * 60 * 60;

// Partitioned makes browsers keep a separate copy of the cookie per top-level website,
// so a cookie set while visiting one website is never sent from another
const UID_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'None',
  partitioned: true,
} satisfies CookieOptions;

// every project gets its own cookie, so projects on the same site never share a user id
function getUserIdCookieName(projectId: bigint) {
  const projectHash = createHash('sha256').update(String(projectId)).digest('hex').slice(0, 10);
  return `vuid_${projectHash}`;
}

// Behind a proxy the cookie is set on the site's registrable domain (e.g. example.com for a proxy on example.com/_v
// or hub.example.com), so all subdomains of the site share it. Without a proxy, or for hosts without a registrable
// domain (localhost, IPs), it's bound to the requested host instead.
function getProxySiteDomain(context: HonoContext) {
  const { proxyHost } = context.var;
  if (!proxyHost) {
    return null;
  }

  return getDomain(`https://${proxyHost}`, { allowPrivateDomains: true });
}

function parseUserId(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

export async function getUserIdFromCookie(context: HonoContext) {
  const { projectId, allowCookies } = context.var;
  const cookieName = getUserIdCookieName(projectId);

  const siteUserId = parseUserId(getCookie(context, cookieName, 'secure'));
  if (siteUserId !== null) {
    return siteUserId;
  }

  const hostUserId = parseUserId(getCookie(context, cookieName, 'host'));
  if (hostUserId !== null) {
    if (getProxySiteDomain(context)) {
      // a beacon request can't send the proxy host, so its cookie is moved to the site's domain on the next request
      setUserIdCookie(context, hostUserId);
    }
    return hostUserId;
  }

  if (!allowCookies) {
    return null;
  }

  // an id from the old shared cookie is only taken over if it's in an active session of this project,
  // so sessions that were running when the per-project cookie was introduced continue
  const legacyUserId = parseUserId(getCookie(context, LEGACY_UID_COOKIE_NAME));
  if (legacyUserId === null || !(await hasActiveSession(projectId, legacyUserId))) {
    return null;
  }

  setUserIdCookie(context, legacyUserId);
  return legacyUserId;
}

export function setUserIdCookie(context: HonoContext, userId: bigint) {
  const cookieName = getUserIdCookieName(context.var.projectId);
  const siteDomain = getProxySiteDomain(context);

  if (!siteDomain) {
    setCookie(context, cookieName, String(userId), {
      ...UID_COOKIE_OPTIONS,
      prefix: 'host',
      maxAge: UID_COOKIE_MAX_AGE_SECONDS,
    });
    return;
  }

  setCookie(context, cookieName, String(userId), {
    ...UID_COOKIE_OPTIONS,
    prefix: 'secure',
    domain: siteDomain,
    maxAge: UID_COOKIE_MAX_AGE_SECONDS,
  });
  if (getCookie(context, cookieName, 'host') !== undefined) {
    deleteCookie(context, cookieName, { ...UID_COOKIE_OPTIONS, prefix: 'host' });
  }
}

export function deleteUserIdCookie(context: HonoContext) {
  const cookieName = getUserIdCookieName(context.var.projectId);
  const siteDomain = getProxySiteDomain(context);

  deleteCookie(context, cookieName, { ...UID_COOKIE_OPTIONS, prefix: 'host' });
  if (siteDomain) {
    deleteCookie(context, cookieName, { ...UID_COOKIE_OPTIONS, prefix: 'secure', domain: siteDomain });
  }

  // the old shared cookie is removed too, with the attributes it was set with, e.g. when a visitor revokes consent
  deleteCookie(context, LEGACY_UID_COOKIE_NAME, {
    path: '/',
    secure: true,
    sameSite: 'None',
    domain: context.var.proxyHost ?? getBaseDomain().split(':')[0], // remove port if present
  });
}
