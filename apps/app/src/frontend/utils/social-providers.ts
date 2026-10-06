import { IS_SELF_HOSTED } from './self-hosted';

/** Identifier of a social login provider the frontend can offer. */
export type SocialProvider = 'google' | 'github';

/** Every social login provider the app supports, in display order. */
export const ALL_SOCIAL_PROVIDERS: readonly SocialProvider[] = ['google', 'github'];

/**
 * Determines which social login providers the frontend offers.
 *
 * The hosted build always offers every provider and never reads the runtime config, which keeps
 * its behaviour independent of anything injected into the page. A self hosted build offers only
 * the providers the backend reported as configured. The reported list is matched against the
 * supported providers, so unknown entries are dropped, and a missing or malformed list offers
 * nothing rather than buttons that lead to a failing authorization request.
 * @param isSelfHosted Whether the bundle was built for a self hosted instance.
 * @param runtimeConfig The runtime config injected by the backend, if any.
 * @returns The providers to offer, in display order.
 */
export function resolveEnabledSocialProviders(
  isSelfHosted: boolean,
  runtimeConfig: VemetricRuntimeConfig | undefined,
): readonly SocialProvider[] {
  if (!isSelfHosted) {
    return ALL_SOCIAL_PROVIDERS;
  }

  const reported: unknown = runtimeConfig?.socialProviders;
  if (!Array.isArray(reported)) {
    return [];
  }

  return ALL_SOCIAL_PROVIDERS.filter((provider) => reported.includes(provider));
}

/** Social login providers offered by this instance, resolved once when the bundle loads. */
export const ENABLED_SOCIAL_PROVIDERS = resolveEnabledSocialProviders(
  IS_SELF_HOSTED,
  IS_SELF_HOSTED && typeof window !== 'undefined' ? window.__VEMETRIC_RUNTIME_CONFIG__ : undefined,
);

/**
 * Checks whether a social login provider is offered by this instance.
 * @param provider The provider to check.
 * @returns true if the provider may be used for sign in, sign up and account linking.
 */
export function isSocialProviderEnabled(provider: SocialProvider): boolean {
  return ENABLED_SOCIAL_PROVIDERS.includes(provider);
}
