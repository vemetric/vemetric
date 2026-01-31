import { useQueryClient } from '@tanstack/react-query';
import { customSessionClient, lastLoginMethodClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import { toaster } from '@/components/ui/toaster';
import { getAppUrl, getBackendUrl } from './url';
import type { Auth } from '../../types';

export const authClient = createAuthClient({
  baseURL: getBackendUrl() + '/auth',
  plugins: [lastLoginMethodClient(), customSessionClient<Auth>()],
});

export const useLogout = () => {
  const queryClient = useQueryClient();

  return {
    logout: async () => {
      await authClient.signOut();
      queryClient.clear();
    },
  };
};

export const loginWithProvider = async (provider: 'google' | 'github', setIsLoading: (value: boolean) => void) => {
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
