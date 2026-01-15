import { test, expect } from '../../fixtures/auth';

test.describe('Project Overview - Authenticated', () => {
  test('onboarded user can see the project overview page', async ({ onboardedUserPage, testScenarios }) => {
    const { onboardedUser } = testScenarios;
    const org = onboardedUser.organizations[0];
    const project = org.projects[0];

    // Navigate to the organization page
    await onboardedUserPage.goto(`/o/${org.organization.id}`);

    // Verify the Projects heading is visible
    await expect(onboardedUserPage.getByRole('heading', { name: 'Projects' })).toBeVisible();

    // Verify the test project is displayed
    await expect(onboardedUserPage.getByText(project.name)).toBeVisible();

    // Verify the "New Project" button/card is present
    await expect(onboardedUserPage.getByText('New Project')).toBeVisible();
  });

  test('onboarded user can navigate to project dashboard', async ({ onboardedUserPage, testScenarios }) => {
    const { onboardedUser } = testScenarios;
    const org = onboardedUser.organizations[0];
    const project = org.projects[0];

    // Navigate to the organization page
    await onboardedUserPage.goto(`/o/${org.organization.id}`);

    // Click on the project to navigate to its dashboard
    await onboardedUserPage.getByRole('link', { name: project.name }).click();

    // Wait for navigation to project page
    await onboardedUserPage.waitForURL(`**/p/${project.id}**`);

    // Project dashboard should be visible (check for some common element)
    // The exact content depends on the project dashboard implementation
    await expect(onboardedUserPage).toHaveURL(new RegExp(`/p/${project.id}`));
  });

  test('multi-org user can see their primary organization projects', async ({ multiOrgUserPage, testScenarios }) => {
    const { multiOrgUser } = testScenarios;
    const primaryOrg = multiOrgUser.organizations[0];
    const project = primaryOrg.projects[0];

    // Navigate to the primary organization page
    await multiOrgUserPage.goto(`/o/${primaryOrg.organization.id}`);

    // Verify the Projects heading is visible
    await expect(multiOrgUserPage.getByRole('heading', { name: 'Projects' })).toBeVisible();

    // Verify the project is displayed
    await expect(multiOrgUserPage.getByText(project.name)).toBeVisible();
  });
});
