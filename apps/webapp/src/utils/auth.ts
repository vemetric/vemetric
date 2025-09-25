import type { Auth } from 'backend';
import { customSessionClient, lastLoginMethodClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import { toaster } from '@/components/ui/toaster';

const hostname = location.hostname.split('.').slice(-2).join('.');

export const authClient = createAuthClient({
  baseURL: 'https://backend.' + hostname + '/auth',
  plugins: [lastLoginMethodClient(), customSessionClient<Auth>()],
});

export const loginWithProvider = async (provider: 'google' | 'github', setIsLoading: (value: boolean) => void) => {
  await authClient.signIn.social(
    {
      provider,
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
