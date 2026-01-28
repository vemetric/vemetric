import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }]],
  globalTeardown: './global-teardown.ts',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'https://app.vemetric.local',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Ignore HTTPS errors for local development with self-signed certs
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
