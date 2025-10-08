import { createFileRoute, Navigate } from '@tanstack/react-router';
import { SplashScreen } from '@/components/splash-screen';
import { authClient } from '@/utils/auth';
import { requireOnboarding } from '@/utils/auth-guards';

export const Route = createFileRoute('/billing')({
  beforeLoad: requireOnboarding,
  pendingComponent: SplashScreen,
  component: RouteComponent,
});

function RouteComponent() {
  const { data: session, isPending: isSessionLoading } = authClient.useSession();

  const project = session?.projects[0];
  if (isSessionLoading || !project) {
    return <SplashScreen />;
  }

  return <Navigate to="/p/$projectId/settings" params={{ projectId: project.id }} search={{ tab: 'billing' }} />;
}
