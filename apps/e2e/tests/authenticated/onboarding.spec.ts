import { testNonOnboarded, testOnboarded, expect } from '../../fixtures/auth';

testNonOnboarded.describe('Onboarding - Non-Onboarded User', () => {
  testNonOnboarded('is redirected to pricing page when accessing org', async ({ authenticatedPage, scenario }) => {
    const org = scenario.organizations[0];

    // Try to access the organization page directly
    await authenticatedPage.goto(`/o/${org.organization.id}`);

    // Should be redirected to the pricing onboarding page
    await authenticatedPage.waitForURL(`**/onboarding/pricing**`);

    // Verify the pricing page content
    await expect(authenticatedPage.getByText('How many events are you going to track?')).toBeVisible();

    // Verify the "Start for free" button is present
    await expect(authenticatedPage.getByRole('button', { name: 'Start for free' })).toBeVisible();

    // Verify we're on step 2 of 3
    await expect(authenticatedPage.getByText('Step')).toBeVisible();
    await expect(authenticatedPage.getByText('2')).toBeVisible();
    await expect(authenticatedPage.getByText('of 3')).toBeVisible();
  });

  testNonOnboarded('sees both free and professional plan options', async ({ authenticatedPage, scenario }) => {
    const org = scenario.organizations[0];

    // Navigate to the pricing page
    await authenticatedPage.goto(`/onboarding/pricing?orgId=${org.organization.id}`);

    // Verify Free plan card is visible
    await expect(authenticatedPage.getByText('Free')).toBeVisible();
    await expect(authenticatedPage.getByText('For small projects to get started')).toBeVisible();

    // Verify Professional plan card is visible
    await expect(authenticatedPage.getByText('Professional')).toBeVisible();
    await expect(authenticatedPage.getByText('Powerful insights for your business')).toBeVisible();

    // Verify pricing details
    await expect(authenticatedPage.getByText('$0')).toBeVisible();
    await expect(authenticatedPage.getByText('events per month', { exact: false })).toBeVisible();
  });
});

testOnboarded.describe('Onboarding - Onboarded User', () => {
  testOnboarded('is redirected to org page when navigating to root', async ({ authenticatedPage, scenario }) => {
    const org = scenario.organizations[0];

    // Navigate to root
    await authenticatedPage.goto('/');

    // Should be redirected to org page
    await authenticatedPage.waitForURL(`**/o/${org.organization.id}**`);
  });
});

testNonOnboarded.describe('Onboarding - Non-Onboarded User Root Navigation', () => {
  testNonOnboarded('is redirected to pricing when navigating to root', async ({ authenticatedPage }) => {
    // Navigate to root
    await authenticatedPage.goto('/');

    // Should be redirected to pricing
    await authenticatedPage.waitForURL(`**/onboarding/pricing**`);
  });
});
