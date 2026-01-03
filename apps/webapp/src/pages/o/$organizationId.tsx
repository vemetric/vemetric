import { createFileRoute } from '@tanstack/react-router';
import { ProjectOverviewPage } from '@/components/pages/project-overview/project-overview-page';
import { SplashScreen } from '@/components/splash-screen';
import { requireOnboarding } from '@/utils/auth-guards';

export const Route = createFileRoute('/o/$organizationId')({
  beforeLoad: requireOnboarding,
  pendingComponent: SplashScreen,
  component: RouteComponent,
});

function RouteComponent() {
  const params = Route.useParams();

  return <ProjectOverviewPage organizationId={params.organizationId} />;
}
