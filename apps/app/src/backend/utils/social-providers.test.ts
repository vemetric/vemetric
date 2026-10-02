import { describe, expect, it } from 'vitest';
import { getEnabledSocialProviders, getSocialProviderCredentials } from './social-providers';

describe('getEnabledSocialProviders', () => {
  it('enables no provider when nothing is configured', () => {
    expect(getEnabledSocialProviders({})).toEqual([]);
  });

  it('enables every provider whose id and secret are both set', () => {
    expect(
      getEnabledSocialProviders({
        GITHUB_CLIENT_ID: 'github-id',
        GITHUB_CLIENT_SECRET: 'github-secret',
        GOOGLE_CLIENT_ID: 'google-id',
        GOOGLE_CLIENT_SECRET: 'google-secret',
      }),
    ).toEqual(['google', 'github']);
  });

  it('enables a single provider independently of the other one', () => {
    expect(getEnabledSocialProviders({ GITHUB_CLIENT_ID: 'github-id', GITHUB_CLIENT_SECRET: 'github-secret' })).toEqual(
      ['github'],
    );
  });

  it('treats blank values as unset', () => {
    expect(
      getEnabledSocialProviders({
        GITHUB_CLIENT_ID: '   ',
        GITHUB_CLIENT_SECRET: '\t',
        GOOGLE_CLIENT_ID: '',
        GOOGLE_CLIENT_SECRET: '',
      }),
    ).toEqual([]);
  });

  it('rejects a provider with only a client id', () => {
    expect(() => getEnabledSocialProviders({ GITHUB_CLIENT_ID: 'github-id' })).toThrow(
      /GITHUB_CLIENT_ID is set but GITHUB_CLIENT_SECRET is empty/,
    );
  });

  it('rejects a provider with only a client secret', () => {
    expect(() => getEnabledSocialProviders({ GOOGLE_CLIENT_SECRET: 'google-secret' })).toThrow(
      /GOOGLE_CLIENT_SECRET is set but GOOGLE_CLIENT_ID is empty/,
    );
  });

  it('rejects a provider whose second value is only whitespace', () => {
    expect(() => getEnabledSocialProviders({ GOOGLE_CLIENT_ID: 'google-id', GOOGLE_CLIENT_SECRET: '  ' })).toThrow(
      /partially configured/,
    );
  });

  it('does not leak the configured value into the error message', () => {
    const error = (() => {
      try {
        getEnabledSocialProviders({ GITHUB_CLIENT_SECRET: 'very-secret-value-123' });
        return undefined;
      } catch (err) {
        return err;
      }
    })();

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).not.toContain('very-secret-value-123');
  });
});

describe('getSocialProviderCredentials', () => {
  it('returns trimmed credentials of enabled providers only', () => {
    expect(
      getSocialProviderCredentials({
        GITHUB_CLIENT_ID: '  github-id  ',
        GITHUB_CLIENT_SECRET: '\tgithub-secret\n',
      }),
    ).toEqual({ github: { clientId: 'github-id', clientSecret: 'github-secret' } });
  });

  it('keeps the registration order of the hosted configuration', () => {
    const credentials = getSocialProviderCredentials({
      GITHUB_CLIENT_ID: 'github-id',
      GITHUB_CLIENT_SECRET: 'github-secret',
      GOOGLE_CLIENT_ID: 'google-id',
      GOOGLE_CLIENT_SECRET: 'google-secret',
    });

    expect(Object.keys(credentials)).toEqual(['google', 'github']);
  });
});
