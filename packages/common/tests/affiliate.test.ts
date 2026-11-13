import { describe, expect, it } from 'vitest';
import { getAffiliateCodeFromCookieHeader, parseAffiliateCode } from '../src/affiliate';

describe('parseAffiliateCode', () => {
  it('accepts codes of letters, digits, dashes and underscores', () => {
    expect(parseAffiliateCode('partner_1-a')).toBe('partner_1-a');
  });

  it('rejects empty, too long or unexpected values', () => {
    expect(parseAffiliateCode(null)).toBeNull();
    expect(parseAffiliateCode(undefined)).toBeNull();
    expect(parseAffiliateCode('')).toBeNull();
    expect(parseAffiliateCode('a'.repeat(65))).toBeNull();
    expect(parseAffiliateCode('bad code')).toBeNull();
    expect(parseAffiliateCode('code;domain=evil.com')).toBeNull();
  });
});

describe('getAffiliateCodeFromCookieHeader', () => {
  it('reads the code from the cookie header', () => {
    expect(getAffiliateCodeFromCookieHeader('auth.session=abc; vemetric_ref=partner_1; other=x')).toBe('partner_1');
  });

  it('ignores missing or invalid codes and similarly named cookies', () => {
    expect(getAffiliateCodeFromCookieHeader(null)).toBeNull();
    expect(getAffiliateCodeFromCookieHeader('other=x')).toBeNull();
    expect(getAffiliateCodeFromCookieHeader('my_vemetric_ref=partner_1')).toBeNull();
    expect(getAffiliateCodeFromCookieHeader('vemetric_ref=bad%20code')).toBeNull();
  });
});
