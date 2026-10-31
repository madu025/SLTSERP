import { defineConfig } from '@playwright/test';

/**
 * Local Finance browser contract suite.
 *
 * This suite intentionally uses the existing non-production storage state and
 * only performs read-only navigation plus client-side validation checks. It is
 * separate from the production smoke project because a Finance role session
 * is required.
 */
export default defineConfig({
  testDir: './tests',
  testMatch: /finance-module\.browser\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-finance-report', open: 'never' }]],
  timeout: 120_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: process.env.FINANCE_BASE_URL || 'http://localhost:3000',
    storageState: '.auth/user.json',
    channel: 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm run dev -p 3000',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
