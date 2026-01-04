import { createFileRoute, redirect } from '@tanstack/react-router';
import { SplashScreen } from '@/components/splash-screen';
import { requireOnboarding } from '@/utils/auth-guards';

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const session = await requireOnboarding();

    // Redirect to the first organization's page
    const firstOrgId = session.organizations[0]?.id;
    if (firstOrgId) {
      throw redirect({
        to: '/o/$organizationId',
        params: { organizationId: firstOrgId },
        replace: true,
      });
    }
  },
  pendingComponent: SplashScreen,
  component: () => <SplashScreen />,
});
