import {
  AFFILIATE_HEADER,
  AFFILIATE_OAUTH_STATE_KEY,
  AFFILIATE_URL_PARAM,
  getAffiliateCodeFromCookieHeader,
  parseAffiliateCode,
} from '@vemetric/common/affiliate';
import { parse as parseJsUrl } from 'jsurl2';

// The code of the affiliate link this visit started with. Kept in memory only: it survives the navigation within
// the app (signup → verification → onboarding) and is sent along when the account is created.
let visitAffiliateCode: string | null = null;

// Handles both raw `?via=code` links from the website and jsurl2-encoded values rewritten by TanStack Router.
const parseAffiliateUrlParam = (raw: string | null) => {
  const direct = parseAffiliateCode(raw);
  if (direct) {
    return direct;
  }
  if (!raw) {
    return null;
  }
  try {
    const decoded = parseJsUrl(raw);
    return typeof decoded === 'string' ? parseAffiliateCode(decoded) : null;
  } catch {
    return null;
  }
};

export const captureAffiliateCodeFromUrl = () => {
  visitAffiliateCode =
    parseAffiliateUrlParam(new URLSearchParams(location.search).get(AFFILIATE_URL_PARAM)) ?? visitAffiliateCode;
};

// Preserves the in-memory code on auth page links so switching between /signup and /login survives a reload.
export const getVisitAffiliateSearch = (): Record<string, string> | undefined =>
  visitAffiliateCode ? { [AFFILIATE_URL_PARAM]: visitAffiliateCode } : undefined;

// The latest affiliate link wins: this visit's code, otherwise the one the visitor agreed to remember on the website
export const getAffiliateCode = () => visitAffiliateCode ?? getAffiliateCodeFromCookieHeader(document.cookie);

// Sent with the email signup, the server saves it on the new account
export const getAffiliateHeaders = (): Record<string, string> => {
  const code = getAffiliateCode();
  return code ? { [AFFILIATE_HEADER]: code } : {};
};

// Passed through the Google/GitHub redirect in the OAuth state, the server saves it if the login creates an account
export const getAffiliateOAuthData = () => {
  const code = getAffiliateCode();
  return code ? { [AFFILIATE_OAUTH_STATE_KEY]: code } : undefined;
};
