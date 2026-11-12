// Affiliate referrals (Klibon). Affiliate links land with `?via=<code>`; the code is kept in a first-party
// cookie on the base domain so vemetric.com and app.vemetric.com share it, saved on the account at signup
// and passed to the Paddle checkout. The website sets the same cookie with an inline script (BaseHead.astro),
// keep the name and lifetime in sync with it and with the cookie policy.

export const AFFILIATE_URL_PARAM = 'via';
export const AFFILIATE_COOKIE_NAME = 'vemetric_ref';
// Matches the cookie window configured in the Klibon program
export const AFFILIATE_COOKIE_MAX_AGE_DAYS = 90;

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
