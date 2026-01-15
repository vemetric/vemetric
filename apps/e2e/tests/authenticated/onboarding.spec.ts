import { test, expect } from '../../fixtures/auth';

test.describe('Onboarding - Authenticated', () => {
  test('non-onboarded user is redirected to pricing page', async ({ nonOnboardedUserPage, testScenarios }) => {
    const { nonOnboardedUser } = testScenarios;
    const org = nonOnboardedUser.organizations[0];

    // Try to access the organization page directly
    await nonOnboardedUserPage.goto(`/o/${org.organization.id}`);

    // Should be redirected to the pricing onboarding page
    await nonOnboardedUserPage.waitForURL(`**/onboarding/pricing**`);

    // Verify the pricing page content
    await expect(nonOnboardedUserPage.getByText('How many events are you going to track?')).toBeVisible();

    // Verify the "Start for free" button is present
    await expect(nonOnboardedUserPage.getByRole('button', { name: 'Start for free' })).toBeVisible();

    // Verify we're on step 2 of 3
    await expect(nonOnboardedUserPage.getByText('Step')).toBeVisible();
    await expect(nonOnboardedUserPage.getByText('2')).toBeVisible();
    await expect(nonOnboardedUserPage.getByText('of 3')).toBeVisible();
  });

  test('non-onboarded user sees both free and professional plan options', async ({
    nonOnboardedUserPage,
    testScenarios,
  }) => {
    const { nonOnboardedUser } = testScenarios;
    const org = nonOnboardedUser.organizations[0];

    // Navigate to the pricing page
    await nonOnboardedUserPage.goto(`/onboarding/pricing?orgId=${org.organization.id}`);

    // Verify Free plan card is visible
    await expect(nonOnboardedUserPage.getByText('Free')).toBeVisible();
    await expect(nonOnboardedUserPage.getByText('For small projects to get started')).toBeVisible();

    // Verify Professional plan card is visible
    await expect(nonOnboardedUserPage.getByText('Professional')).toBeVisible();
    await expect(nonOnboardedUserPage.getByText('Powerful insights for your business')).toBeVisible();

    // Verify pricing details
    await expect(nonOnboardedUserPage.getByText('$0')).toBeVisible();
    await expect(nonOnboardedUserPage.getByText('events per month', { exact: false })).toBeVisible();
  });

  test('authenticated user navigating to root is redirected based on org status', async ({
    onboardedUserPage,
    nonOnboardedUserPage,
    testScenarios,
  }) => {
    // Onboarded user should go to their org page
    await onboardedUserPage.goto('/');
    const { onboardedUser } = testScenarios;
    const onboardedOrg = onboardedUser.organizations[0];
    await onboardedUserPage.waitForURL(`**/o/${onboardedOrg.organization.id}**`);

    // Non-onboarded user should be redirected to pricing
    await nonOnboardedUserPage.goto('/');
    await nonOnboardedUserPage.waitForURL(`**/onboarding/pricing**`);
  });
});
