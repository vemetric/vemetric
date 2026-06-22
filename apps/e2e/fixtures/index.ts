/**
 * E2E Test Fixtures
 *
 * This module exports test fixtures for authenticated tests.
 *
 * Usage:
 * ```ts
 * // For tests with an onboarded user:
 * import { testOnboarded, expect } from '../fixtures';
 *
 * testOnboarded('my test', async ({ authenticatedPage, scenario }) => {
 *   // authenticatedPage is already logged in
 *   // scenario has the user/org/project data
 * });
 *
 * // For tests with a non-onboarded user:
 * import { testNonOnboarded, expect } from '../fixtures';
 *
 * testNonOnboarded('my test', async ({ authenticatedPage, scenario }) => {
 *   // User has an org without completed pricing
 * });
 *
 * // For tests with a multi-org user:
 * import { testMultiOrg, expect } from '../fixtures';
 *
 * // For tests needing multiple different users:
 * import { testAuthenticated, expect } from '../fixtures';
 *
 * testAuthenticated('my test', async ({ createAuthenticatedPage, testScenarios }) => {
 *   const page1 = await createAuthenticatedPage('onboardedUser');
 *   const page2 = await createAuthenticatedPage('nonOnboardedUser');
 * });
 * ```
 */

export {
  testOnboarded,
  testNonOnboarded,
  testMultiOrg,
  testAuthenticated,
  expect,
  getStorageStatePath,
  AUTH_DIR,
} from './auth';

export { TEST_SCENARIOS, cleanupTestData, disconnectDb } from './db';
export type { TestUser, TestOrganization, TestProject, TestScenario, TestScenarioKey } from './db';
