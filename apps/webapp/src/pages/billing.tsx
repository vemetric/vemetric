import { createFileRoute, Navigate } from '@tanstack/react-router';
import { SplashScreen } from '@/components/splash-screen';
import { useAuth } from '@/hooks/use-auth';

export const Route = createFileRoute('/billing')({
  component: RouteComponent,
});

function RouteComponent() {
  const { session, isSessionLoading } = useAuth();

  const project = session?.projects[0];
  if (isSessionLoading || !project) {
    return <SplashScreen />;
  }

  return <Navigate to="/p/$projectId/settings" params={{ projectId: project.id }} search={{ tab: 'billing' }} />;
}
