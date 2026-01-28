import path from 'path';
import { test as base, type Page, type BrowserContext, type APIRequestContext } from '@playwright/test';
import { prismaClient } from 'database';
import { TEST_SCENARIOS, type TestScenario, type TestScenarioKey } from './db';

/**
 * Path to store authentication state files
 */
export const AUTH_DIR = path.join(process.cwd(), 'auth');

/**
 * Get the storage state path for a specific scenario
 */
export function getStorageStatePath(scenarioKey: TestScenarioKey): string {
  return path.join(AUTH_DIR, `${scenarioKey}.json`);
}

/**
 * Authenticate a user via API and return cookies
 * This is much faster than going through the UI
 */
async function authenticateViaApi(
  request: APIRequestContext,
  scenario: TestScenario,
  baseURL: string,
): Promise<{ cookies: Array<{ name: string; value: string; domain: string; path: string }> }> {
  const { user } = scenario;
  const backendUrl = baseURL.replace('app.', 'backend.');

  // Try to sign in first (user might already exist)
  let response = await request.post(`${backendUrl}/auth/sign-in/email`, {
    data: {
      email: user.email,
      password: user.password,
    },
  });

  // If sign-in fails (user doesn't exist), sign up
  if (!response.ok()) {
    response = await request.post(`${backendUrl}/auth/sign-up/email`, {
      data: {
        email: user.email,
        password: user.password,
        name: user.name,
      },
    });

    if (!response.ok()) {
      const errorText = await response.text();
      throw new Error(`Failed to authenticate user ${user.email}: ${errorText}`);
    }

    // Set up test data after signup
    const createdUser = await prismaClient.user.findUnique({
      where: { email: user.email },
    });

    if (createdUser) {
      await setupTestUserData(scenario, createdUser.id);
    }
  }

  // Extract cookies from response headers
  const setCookieHeaders = response.headers()['set-cookie'];
  if (!setCookieHeaders) {
    throw new Error('No cookies returned from authentication');
  }

  // Parse cookies - handle both single cookie and multiple cookies
  const cookieStrings = setCookieHeaders.split(/,(?=[^;]*=)/);
  const domain = new URL(baseURL).hostname.replace('app.', '');

  const cookies = cookieStrings
    .map((cookieStr) => {
      const [nameValue] = cookieStr.split(';');
      const [name, value] = nameValue.split('=');
      if (!name || !value) return null;
      return {
        name: name.trim(),
        value: value.trim(),
        domain: `.${domain}`,
        path: '/',
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  return { cookies };
}

/**
 * Set up test data (orgs and projects) for a user
 */
async function setupTestUserData(scenario: TestScenario, actualUserId: string): Promise<void> {
  const { organizations } = scenario;

  for (const { organization, role, projects } of organizations) {
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

    await prismaClient.userOrganization.upsert({
      where: {
        userId_organizationId: {
          userId: actualUserId,
          organizationId: organization.id,
        },
      },
      create: {
        userId: actualUserId,
        organizationId: organization.id,
        role,
      },
      update: {
        role,
      },
    });

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

// ============================================================================
// Onboarded User Fixtures
// ============================================================================

interface OnboardedUserFixtures {
  authenticatedPage: Page;
  scenario: (typeof TEST_SCENARIOS)['onboardedUser'];
}

/**
 * Test with an authenticated onboarded user (has pricing + projects)
 */
export const testOnboarded = base.extend<OnboardedUserFixtures>({
  scenario: TEST_SCENARIOS.onboardedUser,

  authenticatedPage: async ({ browser, request, baseURL }, use) => {
    const scenario = TEST_SCENARIOS.onboardedUser;
    const { cookies } = await authenticateViaApi(request, scenario, baseURL!);

    const context = await browser.newContext();
    await context.addCookies(cookies);

    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

// ============================================================================
// Non-Onboarded User Fixtures
// ============================================================================

interface NonOnboardedUserFixtures {
  authenticatedPage: Page;
  scenario: (typeof TEST_SCENARIOS)['nonOnboardedUser'];
}

/**
 * Test with an authenticated non-onboarded user (no pricing completed)
 */
export const testNonOnboarded = base.extend<NonOnboardedUserFixtures>({
  scenario: TEST_SCENARIOS.nonOnboardedUser,

  authenticatedPage: async ({ browser, request, baseURL }, use) => {
    const scenario = TEST_SCENARIOS.nonOnboardedUser;
    const { cookies } = await authenticateViaApi(request, scenario, baseURL!);

    const context = await browser.newContext();
    await context.addCookies(cookies);

    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

// ============================================================================
// Multi-Org User Fixtures
// ============================================================================

interface MultiOrgUserFixtures {
  authenticatedPage: Page;
  scenario: (typeof TEST_SCENARIOS)['multiOrgUser'];
}

/**
 * Test with an authenticated user that has multiple organizations
 */
export const testMultiOrg = base.extend<MultiOrgUserFixtures>({
  scenario: TEST_SCENARIOS.multiOrgUser,

  authenticatedPage: async ({ browser, request, baseURL }, use) => {
    const scenario = TEST_SCENARIOS.multiOrgUser;
    const { cookies } = await authenticateViaApi(request, scenario, baseURL!);

    const context = await browser.newContext();
    await context.addCookies(cookies);

    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

// ============================================================================
// Generic authenticated test (for custom scenarios)
// ============================================================================

interface GenericAuthFixtures {
  createAuthenticatedPage: (scenarioKey: TestScenarioKey) => Promise<Page>;
  testScenarios: typeof TEST_SCENARIOS;
}

/**
 * Generic test that allows creating authenticated pages for any scenario
 */
export const testAuthenticated = base.extend<GenericAuthFixtures>({
  testScenarios: TEST_SCENARIOS,

  createAuthenticatedPage: async ({ browser, request, baseURL }, use) => {
    const pages: Page[] = [];
    const contexts: BrowserContext[] = [];

    const createPage = async (scenarioKey: TestScenarioKey): Promise<Page> => {
      const scenario = TEST_SCENARIOS[scenarioKey];
      const { cookies } = await authenticateViaApi(request, scenario, baseURL!);

      const context = await browser.newContext();
      await context.addCookies(cookies);
      contexts.push(context);

      const page = await context.newPage();
      pages.push(page);
      return page;
    };

    await use(createPage);

    // Cleanup
    for (const context of contexts) {
      await context.close();
    }
  },
});

export { expect } from '@playwright/test';
