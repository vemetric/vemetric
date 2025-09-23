import { toaster } from '@/components/ui/toaster';
import { authClient } from '@/utils/auth';

export function useSocialLogin() {
  const loginWithProvider = async (provider: 'google' | 'github', e: React.FormEvent) => {
    e.preventDefault();

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

  return { loginWithProvider };
}
