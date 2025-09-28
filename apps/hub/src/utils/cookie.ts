import { getBaseDomain } from '@vemetric/common/env';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { HonoContext } from '../types';

const UID_COOKIE_NAME = '_vuid';

export function getUserIdFromCookie(context: HonoContext) {
  try {
    return BigInt(getCookie(context, UID_COOKIE_NAME) ?? '');
  } catch {
    return null;
  }
}

export function setUserIdCookie(context: HonoContext, userId: bigint) {
  const { proxyHost } = context.var;

  const expiresAt = new Date();
  expiresAt.setTime(expiresAt.getTime() + 34550000 * 1000);
  setCookie(context, UID_COOKIE_NAME, String(userId), {
    httpOnly: true,
    secure: true,
    sameSite: 'None',
    path: '/',
    domain: proxyHost ?? getBaseDomain().split(':')[0], // remove port if present
    expires: expiresAt,
  });
}

export function deleteUserIdCookie(context: HonoContext) {
  const { proxyHost } = context.var;

  deleteCookie(context, UID_COOKIE_NAME, {
    path: '/',
    secure: true,
    domain: proxyHost ?? getBaseDomain().split(':')[0], // remove port if present
  });
}
