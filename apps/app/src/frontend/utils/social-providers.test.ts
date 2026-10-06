import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveEnabledSocialProviders } from './social-providers';

describe('resolveEnabledSocialProviders', () => {
  it('offers every provider on the hosted build', () => {
    expect(resolveEnabledSocialProviders(false, undefined)).toEqual(['google', 'github']);
  });

  it('ignores the runtime config on the hosted build', () => {
    expect(resolveEnabledSocialProviders(false, { socialProviders: [] })).toEqual(['google', 'github']);
  });

  it('offers the providers the runtime config reports on a self hosted build', () => {
    expect(resolveEnabledSocialProviders(true, { socialProviders: ['github'] })).toEqual(['github']);
  });

  it('keeps the display order regardless of the reported order', () => {
    expect(resolveEnabledSocialProviders(true, { socialProviders: ['github', 'google'] })).toEqual([
      'google',
      'github',
    ]);
  });

  it('offers nothing on a self hosted build without a runtime config', () => {
    expect(resolveEnabledSocialProviders(true, undefined)).toEqual([]);
  });

  it('offers nothing when the runtime config reports no providers', () => {
    expect(resolveEnabledSocialProviders(true, { socialProviders: [] })).toEqual([]);
    expect(resolveEnabledSocialProviders(true, {})).toEqual([]);
  });

  it('drops unknown providers and rejects a malformed list', () => {
    expect(resolveEnabledSocialProviders(true, { socialProviders: ['gitlab', 'google'] })).toEqual(['google']);
    expect(resolveEnabledSocialProviders(true, { socialProviders: 'google' as unknown as readonly string[] })).toEqual(
      [],
    );
  });
});

describe('ENABLED_SOCIAL_PROVIDERS', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete window.__VEMETRIC_RUNTIME_CONFIG__;
    vi.resetModules();
  });

  it('offers every provider on the hosted build even if a runtime config is present', async () => {
    vi.stubEnv('VITE_SELF_HOSTED', '');
    window.__VEMETRIC_RUNTIME_CONFIG__ = { socialProviders: [] };
    vi.resetModules();

    const { ENABLED_SOCIAL_PROVIDERS, isSocialProviderEnabled } = await import('./social-providers');

    expect(ENABLED_SOCIAL_PROVIDERS).toEqual(['google', 'github']);
    expect(isSocialProviderEnabled('github')).toBe(true);
  });

  it('reads the runtime config on a self hosted build', async () => {
    vi.stubEnv('VITE_SELF_HOSTED', 'true');
    window.__VEMETRIC_RUNTIME_CONFIG__ = { socialProviders: ['google'] };
    vi.resetModules();

    const { ENABLED_SOCIAL_PROVIDERS, isSocialProviderEnabled } = await import('./social-providers');

    expect(ENABLED_SOCIAL_PROVIDERS).toEqual(['google']);
    expect(isSocialProviderEnabled('google')).toBe(true);
    expect(isSocialProviderEnabled('github')).toBe(false);
  });
});
