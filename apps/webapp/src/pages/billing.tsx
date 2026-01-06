import { createFileRoute, redirect } from '@tanstack/react-router';
import { SplashScreen } from '@/components/splash-screen';
import { requireAuthentication } from '@/utils/auth-guards';

export const Route = createFileRoute('/billing')({
  beforeLoad: async () => {
    const session = await requireAuthentication();

    // No projects - redirect to home (which will handle onboarding)
    if (session.projects.length === 0) {
      throw redirect({
        to: '/',
        replace: true,
      });
    }

    // Redirect to project settings billing tab
    // The destination route is protected by requireProjectAccess
    throw redirect({
      to: '/p/$projectId/settings',
      params: { projectId: session.projects[0].id },
      search: { tab: 'billing' },
      replace: true,
    });
  },
  pendingComponent: SplashScreen,
  component: () => <SplashScreen />,
});
