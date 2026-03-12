import { prismaClient } from 'database';

/**
 * Test user scenarios for E2E tests
 */
export interface TestUser {
  id: string;
  email: string;
  password: string;
  name: string;
}

export interface TestOrganization {
  id: string;
  name: string;
  pricingOnboarded: boolean;
}

export interface TestProject {
  id: string;
  name: string;
  domain: string;
  token: string;
  organizationId: string;
}

export interface TestScenario {
  user: TestUser;
  organizations: Array<{
    organization: TestOrganization;
    role: 'ADMIN' | 'MEMBER';
    projects: TestProject[];
  }>;
}

/**
 * Pre-defined test scenarios
 */
export const TEST_SCENARIOS = {
  // User with a fully onboarded organization (has pricing + project)
  onboardedUser: {
    user: {
      id: 'e2e-user-onboarded',
      email: 'e2e-onboarded@test.vemetric.local',
      password: 'TestPassword123!',
      name: 'E2E Onboarded User',
    },
    organizations: [
      {
        organization: {
          id: 'e2e-org-onboarded',
          name: 'E2E Onboarded Org',
          pricingOnboarded: true,
        },
        role: 'ADMIN' as const,
        projects: [
          {
            id: 'e2e-project-1',
            name: 'E2E Test Project',
            domain: 'e2e-test.vemetric.local',
            token: 'e2e-token-12345678',
            organizationId: 'e2e-org-onboarded',
          },
        ],
      },
    ],
  },

  // User with a non-onboarded organization (no pricing completed)
  nonOnboardedUser: {
    user: {
      id: 'e2e-user-non-onboarded',
      email: 'e2e-non-onboarded@test.vemetric.local',
      password: 'TestPassword123!',
      name: 'E2E Non-Onboarded User',
    },
    organizations: [
      {
        organization: {
          id: 'e2e-org-non-onboarded',
          name: 'E2E Non-Onboarded Org',
          pricingOnboarded: false,
        },
        role: 'ADMIN' as const,
        projects: [],
      },
    ],
  },

  // User with multiple organizations
  multiOrgUser: {
    user: {
      id: 'e2e-user-multi-org',
      email: 'e2e-multi-org@test.vemetric.local',
      password: 'TestPassword123!',
      name: 'E2E Multi-Org User',
    },
    organizations: [
      {
        organization: {
          id: 'e2e-org-multi-1',
          name: 'E2E Primary Org',
          pricingOnboarded: true,
        },
        role: 'ADMIN' as const,
        projects: [
          {
            id: 'e2e-project-multi-1',
            name: 'Primary Project',
            domain: 'e2e-primary.vemetric.local',
            token: 'e2e-token-primary1',
            organizationId: 'e2e-org-multi-1',
          },
        ],
      },
      {
        organization: {
          id: 'e2e-org-multi-2',
          name: 'E2E Secondary Org',
          pricingOnboarded: true,
        },
        role: 'MEMBER' as const,
        projects: [
          {
            id: 'e2e-project-multi-2',
            name: 'Secondary Project',
            domain: 'e2e-secondary.vemetric.local',
            token: 'e2e-token-secondy',
            organizationId: 'e2e-org-multi-2',
          },
        ],
      },
    ],
  },
} satisfies Record<string, TestScenario>;

export type TestScenarioKey = keyof typeof TEST_SCENARIOS;

/**
 * Clean up test data (use with caution, mainly for teardown)
 */
export async function cleanupTestData(): Promise<void> {
  const testOrgIds = Object.values(TEST_SCENARIOS).flatMap((s) => s.organizations.map((o) => o.organization.id));
  const testProjectIds = Object.values(TEST_SCENARIOS).flatMap((s) =>
    s.organizations.flatMap((o) => o.projects.map((p) => p.id)),
  );

  // Delete test projects
  await prismaClient.project.deleteMany({
    where: { id: { in: testProjectIds } },
  });

  // Delete test user-org relationships
  await prismaClient.userOrganization.deleteMany({
    where: { organizationId: { in: testOrgIds } },
  });

  // Delete test organizations
  await prismaClient.organization.deleteMany({
    where: { id: { in: testOrgIds } },
  });

  // Delete test users by email pattern
  const testEmails = Object.values(TEST_SCENARIOS).map((s) => s.user.email);
  await prismaClient.session.deleteMany({
    where: { user: { email: { in: testEmails } } },
  });

  await prismaClient.account.deleteMany({
    where: { user: { email: { in: testEmails } } },
  });

  await prismaClient.user.deleteMany({
    where: { email: { in: testEmails } },
  });
}

/**
 * Disconnect the Prisma client (call in global teardown)
 */
export async function disconnectDb(): Promise<void> {
  await prismaClient.$disconnect();
}
