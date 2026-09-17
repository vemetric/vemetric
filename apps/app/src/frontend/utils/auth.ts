import { useQueryClient } from '@tanstack/react-query';
import { customSessionClient, emailOTPClient, lastLoginMethodClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import { toaster } from '@/components/ui/toaster';
import { isSocialProviderEnabled } from './social-providers';
import type { SocialProvider } from './social-providers';
import { getAppUrl, getBackendUrl } from './url';
import type { Auth } from '../../../types';

export const authClient = createAuthClient({
  baseURL: getBackendUrl() + '/_api/auth',
  plugins: [lastLoginMethodClient(), emailOTPClient(), customSessionClient<Auth>()],
});

export const useLogout = () => {
  const queryClient = useQueryClient();

  return {
    logout: async () => {
      await authClient.signOut();
      sessionStorage.clear();
      queryClient.clear();
    },
  };
};

/**
 * Starts a sign in or sign up through a social login provider.
 *
 * Providers the instance does not offer are refused before any request is made, so no caller can
 * start an authorization flow the backend has no credentials for.
 * @param provider The provider to authenticate with.
 * @param setIsLoading Callback that reflects the pending request in the calling component.
 */
export const loginWithProvider = async (provider: SocialProvider, setIsLoading: (value: boolean) => void) => {
  if (!isSocialProviderEnabled(provider)) {
    toaster.create({
      title: 'This login method is not available on this instance',
      type: 'error',
    });
    return;
  }

  await authClient.signIn.social(
    {
      provider,
      callbackURL: getAppUrl() + '/redirect',
    },
    {
      onRequest: () => {
        setIsLoading(true);
      },
      onError: (ctx) => {
        setIsLoading(false);
        toaster.create({
          title: ctx.error.message || 'An error occurred during login',
          type: 'error',
        });
      },
    },
  );
};
