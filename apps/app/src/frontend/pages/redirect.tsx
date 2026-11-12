import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { SplashScreen } from '@/components/splash-screen';
import { authClient } from '@/utils/auth';
import { redirectPath } from '@/utils/local-storage';
import { resumePendingOauthAuthorize } from '@/utils/oauth-flow';

export const Route = createFileRoute('/redirect')({
  component: RouteComponent,
});

/**
 * Where every sign-in ends: password login, email verification (code or link) and social login. Only this page
 * continues what the user was doing before signing in, so a new way to sign in just has to end here.
 */
function RouteComponent() {
  const navigate = useNavigate();

  useEffect(() => {
    const continueAfterSignIn = async () => {
      // An app (e.g. Claude) asked for access before the user signed in.
      if (resumePendingOauthAuthorize()) {
        return;
      }

      // E.g. a team invitation the user opened before signing in.
      const redirect = redirectPath.get();
      if (redirect) {
        redirectPath.clear();
        navigate({ to: redirect, replace: true });
        return;
      }

      const session = await authClient.getSession();
      const projects = session.data?.projects ?? [];
      if (projects.length === 1) {
        navigate({ to: '/p/$projectId', params: { projectId: projects[0].id }, replace: true });
      } else {
        navigate({ to: '/', replace: true });
      }
    };
    void continueAfterSignIn();
  }, [navigate]);

  return <SplashScreen />;
}
