// Affiliate referrals (Klibon). Affiliate links land with `?via=<code>`.
// During the visit the code travels in links (website) and in memory (app), nothing is stored on the device. At
// signup it reaches the server in a header (email) or in the OAuth state (social) and is saved on the account, which
// passes it to the Paddle checkout. Only if the visitor agrees in the website's notice is it also kept in a
// first-party cookie on the base domain for later visits (AffiliateReferral.astro in the website repo); keep the
// cookie name in sync with it and with the cookie policy.

export const AFFILIATE_URL_PARAM = 'via';
export const AFFILIATE_COOKIE_NAME = 'vemetric_ref';
export const AFFILIATE_HEADER = 'x-vemetric-affiliate';
export const AFFILIATE_OAUTH_STATE_KEY = 'affiliateCode';

const AFFILIATE_CODE_REGEX = /^[A-Za-z0-9_-]{1,64}$/;

export const parseAffiliateCode = (value: string | null | undefined) => {
  return value && AFFILIATE_CODE_REGEX.test(value) ? value : null;
};

export const getAffiliateCodeFromCookieHeader = (cookieHeader: string | null | undefined) => {
  if (!cookieHeader) {
    return null;
  }

  for (const cookie of cookieHeader.split(';')) {
    const separatorIndex = cookie.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }
    if (cookie.slice(0, separatorIndex).trim() === AFFILIATE_COOKIE_NAME) {
      return parseAffiliateCode(cookie.slice(separatorIndex + 1).trim());
    }
  }

  return null;
};
