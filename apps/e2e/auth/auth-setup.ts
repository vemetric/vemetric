import fs from 'fs';
import { test as setup, expect, type Page } from '@playwright/test';
import { prismaClient } from 'database';
import { getStorageStatePath, AUTH_DIR } from '../fixtures/auth';
import { TEST_SCENARIOS, testUserExists, type TestScenario } from '../fixtures/db';

// Ensure auth directory exists
if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

/**
 * Authenticate a user and save their session state
 */
async function authenticateUser(page: Page, scenario: TestScenario, storageStatePath: string): Promise<void> {
  const { user } = scenario;

  // Check if user exists in database
  const userExists = await testUserExists(user.id);

  if (!userExists) {
    // User doesn't exist - sign up
    await page.goto('/signup');
    await expect(page.getByRole('heading', { name: 'Sign up' })).toBeVisible();

    // Fill signup form
    await page.getByLabel('Name').fill(user.name);
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Password').fill(user.password);

    // Submit and wait for navigation
    await page.getByRole('button', { name: 'Sign up' }).click();

    // Wait for successful signup - should redirect to onboarding or home
    // On localhost, email verification is disabled
    await page.waitForURL((url) => !url.pathname.includes('/signup'), { timeout: 10000 });

    // Get the user from database to get the generated ID
    const createdUser = await prismaClient.user.findUnique({
      where: { email: user.email },
    });

    if (!createdUser) {
      throw new Error(`Failed to create test user: ${user.email}`);
    }

    // Update the user ID in the scenario to match the actual ID
    // This is needed because Better Auth generates the user ID
    const actualUserId = createdUser.id;

    // Set up test data (organizations and projects) for this user
    await setupTestUserDataWithActualId(scenario, actualUserId);
  } else {
    // User exists - sign in
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

    // Fill login form
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Password').fill(user.password);

    // Submit and wait for navigation
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Wait for successful login - should redirect away from login
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
  }

  // Save authentication state
  await page.context().storageState({ path: storageStatePath });
}

/**
 * Set up test data with the actual user ID from the database
 */
async function setupTestUserDataWithActualId(scenario: TestScenario, actualUserId: string): Promise<void> {
  const { organizations } = scenario;

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

    // Create user-organization relationship with the actual user ID
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

// Setup test: Authenticate onboarded user
setup('authenticate onboarded user', async ({ page }) => {
  await authenticateUser(page, TEST_SCENARIOS.onboardedUser, getStorageStatePath('onboardedUser'));
});

// Setup test: Authenticate non-onboarded user
setup('authenticate non-onboarded user', async ({ page }) => {
  await authenticateUser(page, TEST_SCENARIOS.nonOnboardedUser, getStorageStatePath('nonOnboardedUser'));
});

// Setup test: Authenticate multi-org user
setup('authenticate multi-org user', async ({ page }) => {
  await authenticateUser(page, TEST_SCENARIOS.multiOrgUser, getStorageStatePath('multiOrgUser'));
});
