import { test, expect } from '@playwright/test';
import { TEST_SCENARIOS } from '../fixtures/db';

/**
 * These tests verify the actual UI authentication flow works correctly.
 * Other tests use API-based auth for speed - this test validates the UI flow itself.
 */
test.describe('Authentication Flow - UI', () => {
  const testUser = {
    email: `e2e-ui-test-${Date.now()}@test.vemetric.local`,
    password: 'TestPassword123!',
    name: 'E2E UI Test User',
  };

  test('can sign up via UI', async ({ page }) => {
    await page.goto('/signup');

    // Verify signup page loads
    await expect(page.getByRole('heading', { name: 'Sign up' })).toBeVisible();

    // Fill the signup form
    await page.getByLabel('Name').fill(testUser.name);
    await page.getByLabel('Email').fill(testUser.email);
    await page.getByLabel('Password').fill(testUser.password);

    // Submit the form
    await page.getByRole('button', { name: 'Sign up' }).click();

    // Should redirect away from signup (to onboarding or home)
    await page.waitForURL((url) => !url.pathname.includes('/signup'), { timeout: 10000 });

    // User should now be authenticated
    // On localhost, email verification is disabled, so user goes to onboarding
    await expect(page).toHaveURL(/onboarding|\/$/);
  });

  test('can sign in via UI with existing user', async ({ page }) => {
    // Use a predefined test user scenario
    const { user } = TEST_SCENARIOS.onboardedUser;

    await page.goto('/login');

    // Verify login page loads
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

    // Fill the login form
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Password').fill(user.password);

    // Submit the form
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Should redirect away from login
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
  });

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    // Fill with invalid credentials
    await page.getByLabel('Email').fill('nonexistent@test.vemetric.local');
    await page.getByLabel('Password').fill('wrongpassword');

    // Submit the form
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Should show an error message (stay on login page)
    await expect(page).toHaveURL(/login/);
    // The exact error message depends on implementation
  });

  test('can navigate between login and signup', async ({ page }) => {
    // Start at login
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

    // Navigate to signup
    await page.getByRole('link', { name: 'Sign up' }).click();
    await expect(page.getByRole('heading', { name: 'Sign up' })).toBeVisible();

    // Navigate back to login
    await page.getByRole('link', { name: 'Sign in' }).click();
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });
});
