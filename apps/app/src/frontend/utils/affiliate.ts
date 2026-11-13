import {
  AFFILIATE_HEADER,
  AFFILIATE_OAUTH_STATE_KEY,
  AFFILIATE_URL_PARAM,
  getAffiliateCodeFromCookieHeader,
  parseAffiliateCode,
} from '@vemetric/common/affiliate';

// The code of the affiliate link this visit started with. Kept in memory only: it survives the navigation within
// the app (signup → verification → onboarding) and is sent along when the account is created.
let visitAffiliateCode: string | null = null;

export const captureAffiliateCodeFromUrl = () => {
  visitAffiliateCode =
    parseAffiliateCode(new URLSearchParams(location.search).get(AFFILIATE_URL_PARAM)) ?? visitAffiliateCode;
};

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
