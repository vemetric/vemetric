import { testOnboarded, testMultiOrg, expect } from '../../fixtures/auth';

testOnboarded.describe('Project Overview - Onboarded User', () => {
  testOnboarded('can see the project overview page', async ({ authenticatedPage, scenario }) => {
    const org = scenario.organizations[0];
    const project = org.projects[0];

    // Navigate to the organization page
    await authenticatedPage.goto(`/o/${org.organization.id}`);

    // Verify the Projects heading is visible
    await expect(authenticatedPage.getByRole('heading', { name: 'Projects' })).toBeVisible();

    // Verify the test project is displayed
    await expect(authenticatedPage.getByText(project.name)).toBeVisible();

    // Verify the "New Project" button/card is present
    await expect(authenticatedPage.getByText('New Project')).toBeVisible();
  });

  testOnboarded('can navigate to project dashboard', async ({ authenticatedPage, scenario }) => {
    const org = scenario.organizations[0];
    const project = org.projects[0];

    // Navigate to the organization page
    await authenticatedPage.goto(`/o/${org.organization.id}`);

    // Click on the project to navigate to its dashboard
    await authenticatedPage.getByRole('link', { name: project.name }).click();

    // Wait for navigation to project page
    await authenticatedPage.waitForURL(`**/p/${project.id}**`);

    // Project dashboard should be visible
    await expect(authenticatedPage).toHaveURL(new RegExp(`/p/${project.id}`));
  });
});

testMultiOrg.describe('Project Overview - Multi-Org User', () => {
  testMultiOrg('can see their primary organization projects', async ({ authenticatedPage, scenario }) => {
    const primaryOrg = scenario.organizations[0];
    const project = primaryOrg.projects[0];

    // Navigate to the primary organization page
    await authenticatedPage.goto(`/o/${primaryOrg.organization.id}`);

    // Verify the Projects heading is visible
    await expect(authenticatedPage.getByRole('heading', { name: 'Projects' })).toBeVisible();

    // Verify the project is displayed
    await expect(authenticatedPage.getByText(project.name)).toBeVisible();
  });
});
