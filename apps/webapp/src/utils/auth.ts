import type { Auth } from 'backend';
import { customSessionClient, lastLoginMethodClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import { toaster } from '@/components/ui/toaster';

const hostname = location.hostname.split('.').slice(-2).join('.');

export const authClient = createAuthClient({
  baseURL: 'https://backend.' + hostname + '/auth',
  plugins: [lastLoginMethodClient(), customSessionClient<Auth>()],
});

export const loginWithProvider = async (provider: 'google' | 'github') => {
  await authClient.signIn.social(
    {
      provider,
      callbackURL: '/onboarding/organization',
    },
    {
      onError: (ctx) => {
        toaster.create({
          title: ctx.error.message,
          type: 'error',
        });
      },
    },
  );
};
