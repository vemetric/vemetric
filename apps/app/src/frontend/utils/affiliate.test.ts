import { stringify } from 'jsurl2';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadAffiliateModule = async () => {
  vi.resetModules();
  return import('./affiliate');
};

describe('frontend affiliate utilities', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/signup');
    document.cookie = 'vemetric_ref=; max-age=0; path=/';
  });

  it('captures a raw ?via= code in memory and exposes it for auth links', async () => {
    window.history.replaceState({}, '', '/signup?via=partner_1-a');
    const { captureAffiliateCodeFromUrl, getAffiliateCode, getVisitAffiliateSearch } = await loadAffiliateModule();

    captureAffiliateCodeFromUrl();

    expect(getAffiliateCode()).toBe('partner_1-a');
    expect(getVisitAffiliateSearch()).toEqual({ via: 'partner_1-a' });
  });

  it('decodes jsurl2-serialized ?via= values produced by TanStack Router', async () => {
    window.history.replaceState({}, '', `/login?via=${encodeURIComponent(stringify('partner_1-a'))}`);
    const { captureAffiliateCodeFromUrl, getAffiliateCode } = await loadAffiliateModule();

    captureAffiliateCodeFromUrl();

    expect(getAffiliateCode()).toBe('partner_1-a');
  });

  it('prefers the current visit code over the vemetric_ref cookie and falls back to the cookie otherwise', async () => {
    document.cookie = 'vemetric_ref=cookie_partner; path=/';
    const { captureAffiliateCodeFromUrl, getAffiliateCode, getVisitAffiliateSearch } = await loadAffiliateModule();

    captureAffiliateCodeFromUrl();
    expect(getAffiliateCode()).toBe('cookie_partner');
    expect(getVisitAffiliateSearch()).toBeUndefined();

    window.history.replaceState({}, '', '/signup?via=link_partner');
    captureAffiliateCodeFromUrl();
    expect(getAffiliateCode()).toBe('link_partner');
    expect(getVisitAffiliateSearch()).toEqual({ via: 'link_partner' });
  });

  it('ignores invalid ?via= values', async () => {
    window.history.replaceState({}, '', '/signup?via=bad%20code');
    const { captureAffiliateCodeFromUrl, getAffiliateCode } = await loadAffiliateModule();

    captureAffiliateCodeFromUrl();

    expect(getAffiliateCode()).toBeNull();
  });
});
