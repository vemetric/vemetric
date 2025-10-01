import { redirect } from '@tanstack/react-router';
import { authClient } from './auth';

/**
 * Route guard for protected routes - redirects to login if not authenticated
 */
export async function requireAuthentication() {
  const { data: session } = await authClient.getSession();

  if (!session?.user) {
    throw redirect({
      to: '/login',
      replace: true,
    });
  }

  return session;
}

/**
 * Route guard for public routes (login/signup) - redirects to dashboard if already authenticated
 */
export async function requireAnonymous() {
  const { data: session } = await authClient.getSession();

  if (session?.user) {
    throw redirect({
      to: '/',
      replace: true,
    });
  }

  return null;
}

/**
 * Route guard for onboarding flow - ensures proper onboarding sequence
 */
export async function requireOnboarding() {
  const session = await requireAuthentication();

  // Check onboarding status and redirect if necessary
  if (session.organizations.length === 0) {
    throw redirect({
      to: '/onboarding/organization',
      replace: true,
    });
  }

  if (!session.organizations[0].pricingOnboarded) {
    throw redirect({
      to: '/onboarding/pricing',
      replace: true,
    });
  }

  if (session.projects.length === 0) {
    throw redirect({
      to: '/onboarding/project',
      replace: true,
    });
  }

  return session;
}

/**
 * Route guard for onboarding/organization - requires auth but no organization
 */
export async function requireOnboardingOrganization() {
  const session = await requireAuthentication();

  // If already has organization, redirect to root which will handle next steps
  if (session.organizations.length > 0) {
    throw redirect({
      to: '/',
      replace: true,
    });
  }

  return session;
}

/**
 * Route guard for onboarding/pricing - requires auth and organization but not pricing
 */
export async function requireOnboardingPricing() {
  const session = await requireAuthentication();

  // If already completed pricing, redirect to root which will handle next steps
  if (session.organizations.length === 0 || session.organizations[0]?.pricingOnboarded) {
    throw redirect({
      to: '/',
      replace: true,
    });
  }

  return session;
}

/**
 * Route guard for onboarding/project - requires auth, organization, and pricing but no project
 */
export async function requireOnboardingProject() {
  const session = await requireAuthentication();

  // If already has projects, redirect to root which will handle next steps
  if (
    session.organizations.length === 0 ||
    !session.organizations[0]?.pricingOnboarded ||
    session.projects.length > 0
  ) {
    throw redirect({
      to: '/',
      replace: true,
    });
  }

  return session;
}
