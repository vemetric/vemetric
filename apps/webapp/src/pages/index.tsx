import { createFileRoute } from '@tanstack/react-router';
import { ProjectOverviewPage } from '@/components/pages/project-overview/project-overview-page';
import { SplashScreen } from '@/components/splash-screen';
import { authClient } from '@/utils/auth';
import { requireOnboarding } from '@/utils/auth-guards';

export const Route = createFileRoute('/')({
  beforeLoad: requireOnboarding,
  pendingComponent: SplashScreen,
  component: Page,
});

function Page() {
  const { data: session } = authClient.useSession();
  const firstOrganizationId = session?.organizations[0]?.id;

  if (!firstOrganizationId) {
    return <SplashScreen />;
  }

  return <ProjectOverviewPage organizationId={firstOrganizationId} />;
}
