import { isSelfHosted } from '@vemetric/common/self-hosted';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { isNoCachePath } from './route-config';
import type { SocialProviderId } from './utils/social-providers';
import { getEnabledSocialProviders } from './utils/social-providers';

/**
 * Instance specific settings of a self hosted instance, handed to the frontend at runtime.
 */
interface RuntimeConfig {
  appOrigin: string;
  hubOrigin: string;
  rootOrigin: string;
  /** Social login providers that are configured on this instance. */
  socialProviders: SocialProviderId[];
}

const applyIndexHtmlCacheHeaders = (c: { header: (name: string, value: string) => void }) => {
  c.header('Cache-Control', 'no-cache');
  c.header('X-Frame-Options', 'DENY');
};

const setCacheHeaders = (pathname: string, c: { header: (name: string, value: string) => void }) => {
  if (pathname.startsWith('/assets/') || pathname.startsWith('/workbox-')) {
    c.header('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (pathname === '/' || pathname === '/index.html') {
    applyIndexHtmlCacheHeaders(c);
  } else if (isNoCachePath(pathname)) {
    c.header('Cache-Control', 'no-cache');
  } else {
    c.header('Cache-Control', 'public, max-age=3600');
  }
};

/**
 * Reads an origin from the environment and validates that it is an absolute http(s) origin.
 *
 * A self hosted domain can have any number of labels, so the frontend cannot derive the other
 * origins from the browser location and depends on these values being correct. A typo therefore
 * has to fail the process start instead of producing OAuth callbacks and invitation links that
 * point at a host which does not exist.
 * @param name Name of the environment variable to read.
 * @returns The normalized origin without a trailing slash, e.g. `https://app.example.com`.
 * @throws Error if the variable is unset or does not hold an absolute http(s) URL.
 */
function parseOriginEnv(name: string): string {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue.trim() === '') {
    throw new Error(
      `The environment variable ${name} is required on self hosted instances, e.g. https://app.example.com`,
    );
  }

  let url: URL;
  try {
    url = new URL(rawValue.trim());
  } catch {
    // The offending value is intentionally not part of the message, environment variables end
    // up in logs where their content should not.
    throw new Error(`The environment variable ${name} must be an absolute http(s) URL, e.g. https://app.example.com`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`The environment variable ${name} must use the http or https protocol`);
  }

  return url.origin;
}

/**
 * Collects the runtime config of a self hosted instance from the environment.
 *
 * `ROOT_ORIGIN` is optional because the bare domain only redirects to the dashboard, so the app
 * origin is a correct destination when it is not configured. The social providers are resolved
 * by the same helper the auth setup uses, so the frontend never offers a provider the backend
 * has not registered.
 * @returns The origins and enabled social providers handed to the frontend.
 * @throws Error if `APP_ORIGIN` or `HUB_ORIGIN` is missing or invalid, or if a social provider
 * is only partially configured.
 */
function resolveRuntimeConfig(): RuntimeConfig {
  const appOrigin = parseOriginEnv('APP_ORIGIN');
  const hubOrigin = parseOriginEnv('HUB_ORIGIN');
  const rawRootOrigin = process.env.ROOT_ORIGIN;
  const rootOrigin =
    rawRootOrigin === undefined || rawRootOrigin.trim() === '' ? appOrigin : parseOriginEnv('ROOT_ORIGIN');

  return { appOrigin, hubOrigin, rootOrigin, socialProviders: getEnabledSocialProviders() };
}

/**
 * Serializes the runtime config into a literal that is safe to embed in an inline script.
 *
 * The values come from the environment, so they are treated as untrusted input. Escaping `<`,
 * `>` and `&` makes it impossible to close the script element or to smuggle markup through a
 * misconfigured variable, and escaping the two Unicode line separators keeps the literal from
 * breaking across lines in older parsers.
 * @param config The runtime config to serialize.
 * @returns A JSON literal with every character escaped that could terminate the script element.
 */
export function serializeRuntimeConfig(config: RuntimeConfig): string {
  const escapes: Record<string, string> = {
    '<': '\\u003C',
    '>': '\\u003E',
    '&': '\\u0026',
    '\u2028': '\\u2028',
    '\u2029': '\\u2029',
  };

  return JSON.stringify(config).replace(/[<>&\u2028\u2029]/g, (char) => escapes[char]);
}

/**
 * Injects the runtime config into the index document of a self hosted instance.
 *
 * The script is a classic inline script placed at the top of the head, so it runs before the
 * deferred module bundle and the config is available by the time the frontend reads it.
 * @param html The built index document.
 * @param config The runtime config to expose to the frontend.
 * @returns The document with the config script injected.
 * @throws Error if the document has no head element to inject into.
 */
export function injectRuntimeConfig(html: string, config: RuntimeConfig): string {
  const headTag = '<head>';
  const headIndex = html.indexOf(headTag);
  if (headIndex === -1) {
    throw new Error('Could not inject the runtime config, the built index.html has no <head> element.');
  }

  const script = `<script>window.__VEMETRIC_RUNTIME_CONFIG__=${serializeRuntimeConfig(config)};</script>`;
  const insertAt = headIndex + headTag.length;
  return `${html.slice(0, insertAt)}${script}${html.slice(insertAt)}`;
}

/**
 * The runtime config of this instance, or `null` when the backend does not run self hosted.
 *
 * Resolved while the module is loaded, which happens during the process start, so a
 * misconfigured instance fails immediately instead of on the first request.
 */
export const RUNTIME_CONFIG: RuntimeConfig | null = isSelfHosted() ? resolveRuntimeConfig() : null;

/**
 * Creates the Hono app that serves the built frontend.
 *
 * On self hosted instances the index document is served with an injected runtime config, on the
 * hosted instance it is served exactly as it was built.
 * @returns The static file app.
 */
export function createStaticApp() {
  const staticApp = new Hono();

  const webappDist = `${import.meta.dir}/../../dist`;
  const indexHtmlPath = `${webappDist}/index.html`;
  let indexHtml: string | null = null;

  /**
   * Serves the index document, reading and preparing it once for the lifetime of the process.
   * @param c The request context.
   * @returns The index document response.
   */
  const serveIndexHtml = async (c: Context) => {
    if (!indexHtml) {
      const builtHtml = await Bun.file(indexHtmlPath).text();
      indexHtml = RUNTIME_CONFIG ? injectRuntimeConfig(builtHtml, RUNTIME_CONFIG) : builtHtml;
    }
    applyIndexHtmlCacheHeaders(c);
    return c.html(indexHtml);
  };

  if (RUNTIME_CONFIG) {
    // The static middleware below would answer these two paths straight from disk, which would
    // hand out the document without the runtime config. Registered only on self hosted instances
    // so the hosted instance keeps serving them exactly as before.
    staticApp.get('/', serveIndexHtml);
    staticApp.get('/index.html', serveIndexHtml);
  }

  staticApp.use(
    '*',
    serveStatic({
      root: webappDist,
      onFound: (_path, c) => {
        const pathname = new URL(c.req.url).pathname;
        setCacheHeaders(pathname, c);
      },
    }),
  );

  staticApp.get('*', async (c) => {
    const accept = c.req.header('accept') ?? '';
    if (accept.includes('text/html')) {
      return serveIndexHtml(c);
    }

    return c.text('Not Found', 404);
  });

  return staticApp;
}
