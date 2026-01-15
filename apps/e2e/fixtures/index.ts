/**
 * E2E Test Fixtures
 *
 * This module exports all test fixtures for authenticated tests.
 *
 * Usage in tests:
 * ```ts
 * import { test, expect } from '../fixtures';
 *
 * test('my test', async ({ onboardedUserPage }) => {
 *   // Use authenticated page
 * });
 * ```
 */

export { test, expect, getStorageStatePath, AUTH_DIR } from './auth';
export type { AuthFixtures } from './auth';

export {
  TEST_SCENARIOS,
  setupTestUserData,
  cleanupTestData,
  testUserExists,
  disconnectDb,
  ensureTestDataExists,
} from './db';
export type { TestUser, TestOrganization, TestProject, TestScenario, TestScenarioKey } from './db';
