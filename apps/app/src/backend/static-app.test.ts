import { afterEach, describe, expect, it, vi } from 'vitest';

// The static middleware is a Bun runtime binding and has nothing to do with the behaviour under
// test, which is the runtime config the module resolves and injects.
vi.mock('hono/bun', () => ({
  serveStatic: () => async (_c: unknown, next: () => Promise<void>) => next(),
}));

const ORIGIN_ENV_KEYS = [
  'SELF_HOSTED',
  'APP_ORIGIN',
  'HUB_ORIGIN',
  'ROOT_ORIGIN',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
] as const;

/**
 * Imports the module with a fresh module registry so its module level configuration is
 * resolved again for the given environment.
 * @param env Environment variables to apply before the import.
 * @returns The freshly evaluated module.
 */
async function importStaticApp(env: Partial<Record<(typeof ORIGIN_ENV_KEYS)[number], string>>) {
  for (const key of ORIGIN_ENV_KEYS) {
    delete process.env[key];
  }
  Object.assign(process.env, env);
  vi.resetModules();
  return import('./static-app');
}

const SELF_HOSTED_ENV = {
  SELF_HOSTED: 'true',
  APP_ORIGIN: 'https://app.analytics.example.com',
  HUB_ORIGIN: 'https://hub.analytics.example.com',
};

afterEach(() => {
  for (const key of ORIGIN_ENV_KEYS) {
    delete process.env[key];
  }
  vi.resetModules();
});

describe('runtime config resolution', () => {
  it('reads the origins of a self hosted instance and normalizes them', async () => {
    const { RUNTIME_CONFIG } = await importStaticApp({
      ...SELF_HOSTED_ENV,
      APP_ORIGIN: 'https://app.analytics.example.com/dashboard?a=b',
      ROOT_ORIGIN: 'https://analytics.example.com',
    });

    expect(RUNTIME_CONFIG).toEqual({
      appOrigin: 'https://app.analytics.example.com',
      hubOrigin: 'https://hub.analytics.example.com',
      rootOrigin: 'https://analytics.example.com',
      socialProviders: [],
    });
  });

  it('lists only the social providers that are fully configured', async () => {
    const { RUNTIME_CONFIG } = await importStaticApp({
      ...SELF_HOSTED_ENV,
      GITHUB_CLIENT_ID: 'github-id',
      GITHUB_CLIENT_SECRET: 'github-secret',
    });

    expect(RUNTIME_CONFIG?.socialProviders).toEqual(['github']);
  });

  it('lists every social provider when all of them are configured', async () => {
    const { RUNTIME_CONFIG } = await importStaticApp({
      ...SELF_HOSTED_ENV,
      GITHUB_CLIENT_ID: 'github-id',
      GITHUB_CLIENT_SECRET: 'github-secret',
      GOOGLE_CLIENT_ID: 'google-id',
      GOOGLE_CLIENT_SECRET: 'google-secret',
    });

    expect(RUNTIME_CONFIG?.socialProviders).toEqual(['google', 'github']);
  });

  it('fails the start when a social provider is only partially configured', async () => {
    await expect(importStaticApp({ ...SELF_HOSTED_ENV, GOOGLE_CLIENT_ID: 'google-id' })).rejects.toThrow(
      /GOOGLE_CLIENT_SECRET is empty/,
    );
  });

  it('falls back to the app origin when no root origin is configured', async () => {
    const { RUNTIME_CONFIG } = await importStaticApp({ ...SELF_HOSTED_ENV, ROOT_ORIGIN: '' });

    expect(RUNTIME_CONFIG?.rootOrigin).toBe('https://app.analytics.example.com');
  });

  it('resolves no config at all when the instance is not self hosted', async () => {
    const { RUNTIME_CONFIG } = await importStaticApp({});

    expect(RUNTIME_CONFIG).toBeNull();
  });

  it('ignores the origins when the instance is not self hosted', async () => {
    const { RUNTIME_CONFIG } = await importStaticApp({ SELF_HOSTED: 'false', APP_ORIGIN: 'not-a-url' });

    expect(RUNTIME_CONFIG).toBeNull();
  });

  it('rejects a missing app origin', async () => {
    await expect(importStaticApp({ SELF_HOSTED: 'true', HUB_ORIGIN: 'https://hub.example.com' })).rejects.toThrow(
      /APP_ORIGIN is required/,
    );
  });

  it('rejects a missing hub origin', async () => {
    await expect(importStaticApp({ SELF_HOSTED: 'true', APP_ORIGIN: 'https://app.example.com' })).rejects.toThrow(
      /HUB_ORIGIN is required/,
    );
  });

  it('rejects a relative origin', async () => {
    await expect(importStaticApp({ ...SELF_HOSTED_ENV, APP_ORIGIN: 'app.example.com' })).rejects.toThrow(
      /must be an absolute http\(s\) URL/,
    );
  });

  it('rejects an origin that does not use http or https', async () => {
    await expect(importStaticApp({ ...SELF_HOSTED_ENV, APP_ORIGIN: 'javascript:alert(1)' })).rejects.toThrow(
      /must use the http or https protocol/,
    );
  });

  it('does not leak the offending value into the error message', async () => {
    const error = await importStaticApp({ ...SELF_HOSTED_ENV, HUB_ORIGIN: 'ftp://secret.example.com' }).then(
      () => undefined,
      (err: unknown) => err,
    );
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).not.toContain('secret.example.com');
  });
});

describe('serializeRuntimeConfig', () => {
  it('escapes every character that could terminate the script element', async () => {
    const { serializeRuntimeConfig } = await importStaticApp({});

    const serialized = serializeRuntimeConfig({
      appOrigin: '<>&',
      hubOrigin: '\u2028' + '\u2029',
      rootOrigin: 'https://root.example.com',
      socialProviders: [],
    });

    expect(serialized).not.toContain('<');
    expect(serialized).not.toContain('>');
    expect(serialized).not.toContain('&');
    expect(serialized).not.toContain('\u2028');
    expect(serialized).not.toContain('\u2029');
    expect(serialized).toContain('\\u003C\\u003E\\u0026');
    expect(serialized).toContain('\\u2028\\u2029');
  });

  it('stays valid JSON that parses back to the original values', async () => {
    const { serializeRuntimeConfig } = await importStaticApp({});
    const config = {
      appOrigin: 'https://app.example.com',
      hubOrigin: '</script><script>alert(1)</script>',
      rootOrigin: 'https://root.example.com',
      socialProviders: ['github' as const],
    };

    expect(JSON.parse(serializeRuntimeConfig(config))).toEqual(config);
  });
});

describe('injectRuntimeConfig', () => {
  const config = {
    appOrigin: 'https://app.example.com',
    hubOrigin: 'https://hub.example.com',
    rootOrigin: 'https://example.com',
    socialProviders: ['google' as const, 'github' as const],
  };

  it('puts the config script at the very start of the head', async () => {
    const { injectRuntimeConfig } = await importStaticApp({});

    const html = injectRuntimeConfig('<!doctype html><html><head><title>a</title></head><body></body></html>', config);

    expect(html).toContain(
      '<head><script>window.__VEMETRIC_RUNTIME_CONFIG__={"appOrigin":"https://app.example.com","hubOrigin":"https://hub.example.com","rootOrigin":"https://example.com","socialProviders":["google","github"]};</script>',
    );
    expect(html.indexOf('__VEMETRIC_RUNTIME_CONFIG__')).toBeLessThan(html.indexOf('<title>'));
  });

  it('leaves the rest of the document untouched', async () => {
    const { injectRuntimeConfig } = await importStaticApp({});
    const source = '<!doctype html><html><head><title>a</title></head><body><div id="root"></div></body></html>';

    const html = injectRuntimeConfig(source, config);
    const withoutScript = html.replace(/<script>window\.__VEMETRIC_RUNTIME_CONFIG__=.*?<\/script>/, '');

    expect(withoutScript).toBe(source);
  });

  it('cannot be broken out of by a hostile origin', async () => {
    const { injectRuntimeConfig } = await importStaticApp({});

    const html = injectRuntimeConfig('<html><head></head></html>', {
      ...config,
      appOrigin: '</script><script>alert(1)</script>',
    });

    // Exactly one script element, the injected one, so nothing was smuggled in through the value.
    expect(html.match(/<script>/g)).toHaveLength(1);
    expect(html.match(/<\/script>/g)).toHaveLength(1);
    // The payload survives only as escaped text inside a JavaScript string, never as markup.
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('\\u003C/script\\u003E');
  });

  it('fails loudly when the document has no head to inject into', async () => {
    const { injectRuntimeConfig } = await importStaticApp({});

    expect(() => injectRuntimeConfig('<html><body></body></html>', config)).toThrow(/no <head> element/);
  });
});
