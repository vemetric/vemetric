import path from 'path';
import { test as base, type Page, type BrowserContext } from '@playwright/test';
import { TEST_SCENARIOS, type TestScenarioKey } from './db';

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
 * Extended test fixtures with authenticated user contexts
 */
export interface AuthFixtures {
  /**
   * Page authenticated as a user with a fully onboarded organization
   */
  onboardedUserPage: Page;

  /**
   * Page authenticated as a user with a non-onboarded organization
   */
  nonOnboardedUserPage: Page;

  /**
   * Page authenticated as a user with multiple organizations
   */
  multiOrgUserPage: Page;

  /**
   * Access to test scenario data
   */
  testScenarios: typeof TEST_SCENARIOS;

  /**
   * Helper to create an authenticated context for any scenario
   */
  createAuthenticatedContext: (scenarioKey: TestScenarioKey) => Promise<BrowserContext>;
}

/**
 * Extended test with authentication fixtures
 */
export const test = base.extend<AuthFixtures>({
  // Provide test scenarios data
  testScenarios: TEST_SCENARIOS,

  // Create an authenticated context for any scenario
  createAuthenticatedContext: async ({ browser }, use) => {
    const contexts: BrowserContext[] = [];

    const createContext = async (scenarioKey: TestScenarioKey): Promise<BrowserContext> => {
      const storagePath = getStorageStatePath(scenarioKey);
      const context = await browser.newContext({ storageState: storagePath });
      contexts.push(context);
      return context;
    };

    await use(createContext);

    // Cleanup all created contexts
    for (const context of contexts) {
      await context.close();
    }
  },

  // Page for onboarded user
  onboardedUserPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: getStorageStatePath('onboardedUser'),
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  // Page for non-onboarded user
  nonOnboardedUserPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: getStorageStatePath('nonOnboardedUser'),
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  // Page for multi-org user
  multiOrgUserPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: getStorageStatePath('multiOrgUser'),
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect } from '@playwright/test';
