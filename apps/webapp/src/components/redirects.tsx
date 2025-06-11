import { Navigate, useRouterState } from '@tanstack/react-router';
import type { PropsWithChildren } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { SplashScreen } from './splash-screen';

const PUBLIC_ROUTES = ['/login', '/signup', '/reset-password'];

export const Redirects = ({ children }: PropsWithChildren) => {
  const { location } = useRouterState();
  const { isSessionLoading, isLoggedIn, session } = useAuth();

  if (isSessionLoading) {
    return <SplashScreen />;
  }

  if (location.pathname.startsWith('/verify-email') || location.pathname.startsWith('/public/')) {
    return children;
  }

  const isOnPublicRoute = PUBLIC_ROUTES.includes(location.pathname);
  if (isLoggedIn && isOnPublicRoute) {
    return session.projects.length === 1 ? (
      <Navigate to="/p/$projectId" params={{ projectId: session.projects[0].id }} replace />
    ) : (
      <Navigate to="/" replace />
    );
  } else if (!isLoggedIn && !isOnPublicRoute) {
    if (location.pathname === '/billing') {
      return <Navigate to="/signup" replace />;
    }

    return <Navigate to="/login" replace />;
  }

  if (isLoggedIn) {
    if (session.organizations.length === 0) {
      if (location.pathname !== '/onboarding/organization') {
        return <Navigate to="/onboarding/organization" replace />;
      }
    } else if (!session.organizations[0].pricingOnboarded) {
      if (location.pathname !== '/onboarding/pricing') {
        return <Navigate to="/onboarding/pricing" replace />;
      }
    } else if (session.projects.length === 0) {
      if (location.pathname !== '/onboarding/project') {
        return <Navigate to="/onboarding/project" replace />;
      }
    } else {
      if (location.pathname === '/p' || location.pathname === '/p/' || location.pathname.startsWith('/onboarding')) {
        return session.projects.length === 1 ? (
          <Navigate to="/p/$projectId" params={{ projectId: session.projects[0].id }} replace />
        ) : (
          <Navigate to="/" replace />
        );
      }
    }
  }

  return children;
};
