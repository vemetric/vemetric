import { useQueryClient } from '@tanstack/react-query';
import { customSessionClient, lastLoginMethodClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import { toaster } from '@/components/ui/toaster';
import type { auth } from '@/server/auth';
import { getAppUrl } from './url';

const authBaseUrl = (() => {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/auth`;
  }

  const appUrl =
    process.env.APP_URL ??
    process.env.VITE_APP_URL ??
    process.env.VEMETRIC_APP_URL ??
    'http://localhost:4000';
  return `${appUrl.replace(/\/$/, '')}/auth`;
})();

export const authClient = createAuthClient({
  baseURL: authBaseUrl,
  plugins: [lastLoginMethodClient(), customSessionClient<typeof auth>()],
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
      callbackURL: getAppUrl() + '/',
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
