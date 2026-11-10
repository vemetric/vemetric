import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { SplashScreen } from '@/components/splash-screen';
import { redirectPath } from '@/utils/local-storage';
import { resumePendingOauthAuthorize } from '@/utils/oauth-flow';

export const Route = createFileRoute('/redirect')({
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();

  useEffect(() => {
    // After a social login that was part of an OAuth flow (e.g. connecting Claude).
    if (resumePendingOauthAuthorize()) {
      return;
    }

    const redirect = redirectPath.get();
    if (redirect) {
      redirectPath.clear();
      navigate({ to: redirect });
    } else {
      navigate({ to: '/' });
    }
  }, [navigate]);

  return <SplashScreen />;
}
