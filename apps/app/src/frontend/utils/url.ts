import { IS_SELF_HOSTED } from './self-hosted';

type SubDomain = 'app' | 'hub';

/**
 * Validates an origin handed to the frontend by the backend at runtime.
 *
 * @param value The raw value from the runtime config.
 * @param propertyName The name of the property, used in the error message.
 * @returns The normalized origin without a trailing slash, e.g. `https://app.example.com`.
 * @throws {Error} If the value is missing or not an absolute http(s) URL.
 */
function parseOrigin(value: unknown, propertyName: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`The runtime config is missing "${propertyName}". Check APP_ORIGIN and HUB_ORIGIN on the server.`);
  }

  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error(`The runtime config property "${propertyName}" is not an absolute http(s) URL.`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`The runtime config property "${propertyName}" must use the http or https protocol.`);
  }

  return url.origin;
}

/**
 * Reads the origins of a self hosted instance from the runtime config.
 *
 * A self hosted domain can have any number of labels, so the origins cannot be derived from
 * `location.hostname`. They are not baked into the bundle either, because the published images
 * have to stay independent of the domain they are deployed on. The backend injects them into the
 * index document instead, which is why a missing config means the instance is misconfigured and
 * has to fail loudly rather than fall back to a host that does not exist.
 *
 * `rootOrigin` is optional and defaults to the app origin, since the bare domain only redirects
 * to the dashboard.
 * @returns The app, hub and root origins of the instance.
 * @throws {Error} If the runtime config is absent or holds invalid origins.
 */
function resolveSelfHostedOrigins() {
  const runtimeConfig = window.__VEMETRIC_RUNTIME_CONFIG__;
  if (!runtimeConfig) {
    throw new Error('The runtime config is missing. The server did not inject __VEMETRIC_RUNTIME_CONFIG__.');
  }

  const app = parseOrigin(runtimeConfig.appOrigin, 'appOrigin');
  const hub = parseOrigin(runtimeConfig.hubOrigin, 'hubOrigin');
  const rawRootOrigin = runtimeConfig.rootOrigin;
  const root =
    typeof rawRootOrigin === 'string' && rawRootOrigin.trim() !== '' ? parseOrigin(rawRootOrigin, 'rootOrigin') : app;

  return { app, hub, root };
}

/**
 * The configured origins of a self hosted instance, or `undefined` on the hosted build.
 *
 * Resolved at module load so a misconfigured instance fails immediately and visibly instead of
 * producing broken OAuth callbacks and invitation links later on.
 */
const SELF_HOSTED_ORIGINS = IS_SELF_HOSTED ? resolveSelfHostedOrigins() : undefined;

/**
 * Returns the two label base domain of the current location, e.g. `vemetric.com`.
 *
 * Only meaningful on the hosted instance, where every service lives on a subdomain of the same
 * two label domain.
 * @returns The base domain derived from `location.hostname`.
 */
export function getHostname() {
  return location.hostname.split('.').slice(-2).join('.');
}

/**
 * Builds the origin of one of the services from the current location.
 *
 * @param subDomain The subdomain of the service, or `undefined` for the bare domain.
 * @returns The absolute origin of the service, including the current port when it is non standard.
 */
function getUrl(subDomain?: SubDomain) {
  const hostname = getHostname();
  const subDomainPrefix = subDomain ? `${subDomain}.` : '';
  const port = Number(location.port);
  let portSuffix = '';
  if (!isNaN(port) && port !== 80 && port !== 443 && port !== 0) {
    portSuffix = `:${port}`;
  }
  return `${location.protocol}//${subDomainPrefix}${hostname}${portSuffix}`;
}

/**
 * Returns the origin of the landing page, which is the bare domain of the installation.
 *
 * @returns The absolute origin of the landing page.
 */
export function getLandingPageUrl() {
  return SELF_HOSTED_ORIGINS ? SELF_HOSTED_ORIGINS.root : getUrl();
}

/**
 * Returns the origin of the dashboard, used for OAuth callbacks and invitation links.
 *
 * @returns The absolute origin of the dashboard.
 */
export function getAppUrl() {
  return SELF_HOSTED_ORIGINS ? SELF_HOSTED_ORIGINS.app : getUrl('app');
}

/**
 * Returns the origin the frontend talks to for its own API calls.
 *
 * This is always the origin the document was served from, so it needs no configuration.
 * @returns The absolute origin of the backend.
 */
export function getBackendUrl() {
  return location.origin;
}

/**
 * Returns the origin of the event ingestion endpoint.
 *
 * @returns The absolute origin of the hub.
 */
export function getHubUrl() {
  return SELF_HOSTED_ORIGINS ? SELF_HOSTED_ORIGINS.hub : getUrl('hub');
}

/**
 * Serializes an object into a query string.
 *
 * @param params The query parameters to serialize.
 * @returns The encoded query string including the leading `?`, or an empty string.
 */
export function formatQueryParams(params: Record<string, any>): string {
  const entries = Object.entries(params);
  if (entries.length === 0) return '';
  const queryString = entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  return `?${queryString}`;
}
