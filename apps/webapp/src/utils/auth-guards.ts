import { redirect } from '@tanstack/react-router';
import { authClient } from './auth';

type getSession = ReturnType<typeof authClient.getSession<{}>>;
type Session = NonNullable<Awaited<getSession>['data']>;

/**
 * Helper to get an organization's onboarding status
 */
function getOrganizationOnboardingStatus(session: Session, organizationId: string) {
  const org = session.organizations.find((o) => o.id === organizationId);
  if (!org) return null;

  const orgProjects = session.projects.filter((p) => p.organizationId === organizationId);

  return {
    organization: org,
    hasPricing: org.pricingOnboarded,
    hasProjects: orgProjects.length > 0,
    isFullyOnboarded: org.pricingOnboarded && orgProjects.length > 0,
    isAdmin: org.role === 'ADMIN',
  };
}

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
 * Route guard for a specific organization - checks if that org is fully onboarded
 */
export async function requireOrganizationOnboarded(organizationId: string) {
  const session = await requireAuthentication();

  const status = getOrganizationOnboardingStatus(session, organizationId);

  if (!status) {
    // User doesn't have access to this org, redirect to home
    throw redirect({ to: '/', replace: true });
  }

  if (!status.hasPricing) {
    throw redirect({
      to: '/onboarding/pricing',
      search: { orgId: organizationId },
      replace: true,
    });
  }

  if (!status.hasProjects) {
    throw redirect({
      to: '/onboarding/project',
      search: { orgId: organizationId },
      replace: true,
    });
  }

  return session;
}

/**
 * Route guard for project access - checks if user has access to the project
 * Note: If a project exists in the session, the organization must already be onboarded
 * (projects can only be created after completing the onboarding flow)
 */
export async function requireProjectAccess(projectId: string) {
  const session = await requireAuthentication();

  // Find the project in the user's accessible projects
  const project = session.projects.find((p) => p.id === projectId);

  // User doesn't have access to this project
  if (!project) {
    throw redirect({ to: '/', replace: true });
  }

  return { session, project };
}

/**
 * Route guard for onboarding/organization - for new users OR existing users creating new org
 * New users (no orgs): show full form with firstName
 * Existing users: show only org name field (accessed via "Create Organization" button)
 */
export async function requireOnboardingOrganization() {
  const session = await requireAuthentication();
  // Allow access regardless of existing orgs - both new and existing users can create orgs
  return session;
}

/**
 * Route guard for onboarding/pricing - requires orgId in search params
 * Validates that the org exists, user has access, user is admin, and pricing isn't already done
 */
export async function requireOnboardingPricing({ search }: { search: { orgId: string } }) {
  const session = await requireAuthentication();
  const { orgId } = search;

  const status = getOrganizationOnboardingStatus(session, orgId);

  // Org doesn't exist or user doesn't have access
  if (!status) {
    throw redirect({ to: '/', replace: true });
  }

  // Non-admin members can't complete onboarding - redirect to waiting page
  if (!status.isAdmin) {
    throw redirect({
      to: '/onboarding/waiting',
      search: { orgId },
      replace: true,
    });
  }

  // Pricing already done - redirect to next step or home
  if (status.hasPricing) {
    if (!status.hasProjects) {
      throw redirect({
        to: '/onboarding/project',
        search: { orgId },
        replace: true,
      });
    }
    throw redirect({ to: '/o/$organizationId', params: { organizationId: orgId }, replace: true });
  }

  return session;
}

/**
 * Route guard for onboarding/project - requires orgId in search params
 * Validates that the org exists, user has access, user is admin, pricing is done, and no projects yet
 */
export async function requireOnboardingProject({ search }: { search: { orgId: string } }) {
  const session = await requireAuthentication();
  const { orgId } = search;

  const status = getOrganizationOnboardingStatus(session, orgId);

  // Org doesn't exist or user doesn't have access
  if (!status) {
    throw redirect({ to: '/', replace: true });
  }

  // Non-admin members can't complete onboarding - redirect to waiting page
  if (!status.isAdmin) {
    throw redirect({
      to: '/onboarding/waiting',
      search: { orgId },
      replace: true,
    });
  }

  // Pricing not done - redirect to pricing
  if (!status.hasPricing) {
    throw redirect({
      to: '/onboarding/pricing',
      search: { orgId },
      replace: true,
    });
  }

  // Already has projects - redirect to home
  if (status.hasProjects) {
    throw redirect({ to: '/o/$organizationId', params: { organizationId: orgId }, replace: true });
  }

  return session;
}

/**
 * Route guard for onboarding/waiting - for members waiting for admin to complete setup
 * Validates org exists, user has access, and org is not fully onboarded yet
 */
export async function requireOnboardingWaiting({ search }: { search: { orgId: string } }) {
  const session = await requireAuthentication();
  const { orgId } = search;

  const status = getOrganizationOnboardingStatus(session, orgId);

  // Org doesn't exist or user doesn't have access
  if (!status) {
    throw redirect({ to: '/', replace: true });
  }

  // Admins should go to the actual onboarding pages
  if (status.isAdmin) {
    if (!status.hasPricing) {
      throw redirect({
        to: '/onboarding/pricing',
        search: { orgId },
        replace: true,
      });
    }
    if (!status.hasProjects) {
      throw redirect({
        to: '/onboarding/project',
        search: { orgId },
        replace: true,
      });
    }
    // Fully onboarded - redirect to home
    throw redirect({ to: '/o/$organizationId', params: { organizationId: orgId }, replace: true });
  }

  // Org is fully onboarded - redirect to home
  if (status.isFullyOnboarded) {
    throw redirect({ to: '/o/$organizationId', params: { organizationId: orgId }, replace: true });
  }

  return { session, orgStatus: status };
}
