/**
 * Decides which social login providers this instance offers.
 *
 * Kept apart from the better-auth setup in `auth.ts` so the decision can be tested without
 * constructing the auth instance, and so the static app can hand the same list to the frontend.
 */

/** Social login providers the app supports, in the order they are registered. */
export const SUPPORTED_SOCIAL_PROVIDERS = ['google', 'github'] as const;

/** Identifier of a supported social login provider. */
export type SocialProviderId = (typeof SUPPORTED_SOCIAL_PROVIDERS)[number];

/** OAuth client credentials of a single provider. */
export interface SocialProviderCredentials {
  clientId: string;
  clientSecret: string;
}

/** Environment variables holding the client id and secret of each provider. */
const PROVIDER_ENV_KEYS: Record<SocialProviderId, { clientId: string; clientSecret: string }> = {
  google: { clientId: 'GOOGLE_CLIENT_ID', clientSecret: 'GOOGLE_CLIENT_SECRET' },
  github: { clientId: 'GITHUB_CLIENT_ID', clientSecret: 'GITHUB_CLIENT_SECRET' },
};

/**
 * Reads an environment variable and treats whitespace only values as unset.
 * @param env The environment to read from.
 * @param key Name of the variable.
 * @returns The trimmed value, or an empty string when the variable is unset or blank.
 */
function readTrimmed(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Collects the credentials of every provider that is fully configured.
 *
 * A provider is enabled only when both its client id and its client secret are set. Registering
 * a provider without them produces authorization requests with `client_id=undefined` and failing
 * callbacks, so an unconfigured provider is left out entirely. Setting only one of the two values
 * is an operator mistake and fails the process start, since silently disabling the provider would
 * hide the misconfiguration.
 * @param env The environment to read from, defaults to `process.env`.
 * @returns The credentials keyed by provider, containing only enabled providers.
 * @throws Error if a provider has exactly one of its two values set. The message names the
 * variables but never their values.
 */
export function getSocialProviderCredentials(
  env: NodeJS.ProcessEnv = process.env,
): Partial<Record<SocialProviderId, SocialProviderCredentials>> {
  const credentials: Partial<Record<SocialProviderId, SocialProviderCredentials>> = {};

  SUPPORTED_SOCIAL_PROVIDERS.forEach((provider) => {
    const keys = PROVIDER_ENV_KEYS[provider];
    const clientId = readTrimmed(env, keys.clientId);
    const clientSecret = readTrimmed(env, keys.clientSecret);

    if (clientId === '' && clientSecret === '') {
      return;
    }

    if (clientId === '' || clientSecret === '') {
      const missingKey = clientId === '' ? keys.clientId : keys.clientSecret;
      const presentKey = clientId === '' ? keys.clientSecret : keys.clientId;
      throw new Error(
        `The ${provider} login is only partially configured: ${presentKey} is set but ${missingKey} is empty. ` +
          `Set both variables to enable the provider, or leave both empty to disable it.`,
      );
    }

    credentials[provider] = { clientId, clientSecret };
  });

  return credentials;
}

/**
 * Lists the social login providers this instance offers.
 * @param env The environment to read from, defaults to `process.env`.
 * @returns The enabled providers in registration order.
 * @throws Error if a provider is only partially configured, see `getSocialProviderCredentials`.
 */
export function getEnabledSocialProviders(env: NodeJS.ProcessEnv = process.env): SocialProviderId[] {
  const credentials = getSocialProviderCredentials(env);
  return SUPPORTED_SOCIAL_PROVIDERS.filter((provider) => credentials[provider] !== undefined);
}
