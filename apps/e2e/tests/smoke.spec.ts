import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('login page loads successfully', async ({ page }) => {
    await page.goto('/login');

    // Verify the page title/heading
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

    // Verify essential form elements are present
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();

    // Verify OAuth buttons are present
    await expect(page.getByRole('button', { name: /Google/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /GitHub/i })).toBeVisible();

    // Verify signup link is present
    await expect(page.getByRole('link', { name: 'Sign up' })).toBeVisible();
  });
});
