import {
  AFFILIATE_COOKIE_MAX_AGE_DAYS,
  AFFILIATE_COOKIE_NAME,
  AFFILIATE_URL_PARAM,
  getAffiliateCodeFromCookieHeader,
  parseAffiliateCode,
} from '@vemetric/common/affiliate';
import { getHostname } from './url';

// Affiliate links can also point straight at the app (e.g. the signup page), so the app keeps the code too.
// Last click wins: a newer affiliate link replaces the code.
export const captureAffiliateCodeFromUrl = () => {
  const code = parseAffiliateCode(new URLSearchParams(location.search).get(AFFILIATE_URL_PARAM));
  if (!code) {
    return;
  }

  const hostname = getHostname();
  const attributes = [
    'path=/',
    `max-age=${AFFILIATE_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60}`,
    'samesite=lax',
    hostname.includes('.') ? `domain=.${hostname}` : '',
    location.protocol === 'https:' ? 'secure' : '',
  ].filter(Boolean);
  document.cookie = `${AFFILIATE_COOKIE_NAME}=${code}; ${attributes.join('; ')}`;
};

export const getAffiliateCodeFromCookie = () => getAffiliateCodeFromCookieHeader(document.cookie);
