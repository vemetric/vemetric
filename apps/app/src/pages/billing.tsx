import { createFileRoute, redirect } from '@tanstack/react-router';
import { SplashScreen } from '@/components/splash-screen';
import { requireAuthentication, requireOrganizationOnboarded } from '@/utils/auth-guards';

export const Route = createFileRoute('/billing')({
  beforeLoad: async () => {
    const session = await requireAuthentication();

    // No organizations - redirect to home (which will handle onboarding)
    if (session.organizations.length === 0) {
      throw redirect({
        to: '/',
        replace: true,
      });
    }

    const firstOrganization = session.organizations[0];
    await requireOrganizationOnboarded(firstOrganization.id);

    throw redirect({
      to: '/o/$organizationId',
      params: { organizationId: firstOrganization.id },
      search: { orgSettings: 'billing', pricingDialog: true },
      replace: true,
    });
  },
  pendingComponent: SplashScreen,
  component: () => <SplashScreen />,
});
