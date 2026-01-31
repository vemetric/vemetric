import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { SplashScreen } from '@/components/splash-screen';
import { redirectPath } from '@/utils/local-storage';

export const Route = createFileRoute('/redirect')({
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();

  useEffect(() => {
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
