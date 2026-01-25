import { createFileRoute, redirect } from '@tanstack/react-router';
import { SplashScreen } from '~/components/splash-screen';
import { requireAuthentication } from '~/utils/auth-guards';

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const session = await requireAuthentication();

    // No organizations - start onboarding
    if (session.organizations.length === 0) {
      throw redirect({
        to: '/onboarding/organization',
        search: (search) => search,
        replace: true,
      });
    }

    // Redirect to the first organization's page
    // Let that route handle org-specific onboarding checks
    throw redirect({
      to: '/o/$organizationId',
      params: { organizationId: session.organizations[0].id },
      search: (search) => search,
      replace: true,
    });
  },
  pendingComponent: SplashScreen,
  component: () => <SplashScreen />,
});
