import { defineConfig, devices } from '@playwright/test';

/**
 * Read-only smoke suite for an already deployed environment.
 * It deliberately has no webServer: the target must be supplied explicitly.
 */
export default defineConfig({
  testDir: './tests',
  testMatch: /production-smoke\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-production-report', open: 'never' }],
  ],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: process.env.SMOKE_BASE_URL || process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
});
