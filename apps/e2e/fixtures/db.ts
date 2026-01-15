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
 * Ensure test data exists in the database
 * This creates the organizations, projects, and user associations
 * Note: Users are created via the signup API in auth-setup.ts
 */
export async function ensureTestDataExists(scenario: TestScenario): Promise<void> {
  const { user, organizations } = scenario;

  // Check if user exists
  const existingUser = await prismaClient.user.findUnique({
    where: { id: user.id },
  });

  if (!existingUser) {
    // User doesn't exist yet - they will be created via signup API
    // We just need to ensure the user ID is unique
    return;
  }

  // Create organizations and projects for existing user
  for (const { organization, role, projects } of organizations) {
    // Upsert organization
    await prismaClient.organization.upsert({
      where: { id: organization.id },
      create: {
        id: organization.id,
        name: organization.name,
        pricingOnboarded: organization.pricingOnboarded,
      },
      update: {
        name: organization.name,
        pricingOnboarded: organization.pricingOnboarded,
      },
    });

    // Upsert user-organization relationship
    await prismaClient.userOrganization.upsert({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: organization.id,
        },
      },
      create: {
        userId: user.id,
        organizationId: organization.id,
        role,
      },
      update: {
        role,
      },
    });

    // Upsert projects
    for (const project of projects) {
      await prismaClient.project.upsert({
        where: { id: project.id },
        create: {
          id: project.id,
          name: project.name,
          domain: project.domain,
          token: project.token,
          organizationId: project.organizationId,
        },
        update: {
          name: project.name,
          domain: project.domain,
        },
      });
    }
  }
}

/**
 * Set up test data for a user after they've been created via signup
 */
export async function setupTestUserData(scenario: TestScenario): Promise<void> {
  const { user, organizations } = scenario;

  for (const { organization, role, projects } of organizations) {
    // Create organization
    await prismaClient.organization.upsert({
      where: { id: organization.id },
      create: {
        id: organization.id,
        name: organization.name,
        pricingOnboarded: organization.pricingOnboarded,
      },
      update: {
        name: organization.name,
        pricingOnboarded: organization.pricingOnboarded,
      },
    });

    // Create user-organization relationship
    await prismaClient.userOrganization.upsert({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: organization.id,
        },
      },
      create: {
        userId: user.id,
        organizationId: organization.id,
        role,
      },
      update: {
        role,
      },
    });

    // Create projects
    for (const project of projects) {
      await prismaClient.project.upsert({
        where: { id: project.id },
        create: {
          id: project.id,
          name: project.name,
          domain: project.domain,
          token: project.token,
          organizationId: project.organizationId,
        },
        update: {
          name: project.name,
          domain: project.domain,
        },
      });
    }
  }
}

/**
 * Clean up test data (use with caution, mainly for teardown)
 */
export async function cleanupTestData(): Promise<void> {
  const testUserIds = Object.values(TEST_SCENARIOS).map((s) => s.user.id);
  const testOrgIds = Object.values(TEST_SCENARIOS).flatMap((s) => s.organizations.map((o) => o.organization.id));
  const testProjectIds = Object.values(TEST_SCENARIOS).flatMap((s) =>
    s.organizations.flatMap((o) => o.projects.map((p) => p.id)),
  );

  // Delete in order to respect foreign key constraints
  await prismaClient.project.deleteMany({
    where: { id: { in: testProjectIds } },
  });

  await prismaClient.userOrganization.deleteMany({
    where: { userId: { in: testUserIds } },
  });

  await prismaClient.organization.deleteMany({
    where: { id: { in: testOrgIds } },
  });

  await prismaClient.session.deleteMany({
    where: { userId: { in: testUserIds } },
  });

  await prismaClient.account.deleteMany({
    where: { userId: { in: testUserIds } },
  });

  await prismaClient.user.deleteMany({
    where: { id: { in: testUserIds } },
  });
}

/**
 * Check if a test user exists in the database
 */
export async function testUserExists(userId: string): Promise<boolean> {
  const user = await prismaClient.user.findUnique({
    where: { id: userId },
  });
  return user !== null;
}

/**
 * Disconnect the Prisma client (call in global teardown)
 */
export async function disconnectDb(): Promise<void> {
  await prismaClient.$disconnect();
}
