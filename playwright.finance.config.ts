import 'dotenv/config';
import { defineConfig } from '@playwright/test';

const hasE2EAuth = Boolean(process.env.E2E_USERNAME && process.env.E2E_PASSWORD);

if (!hasE2EAuth) {
  throw new Error(
    'Finance browser QA requires E2E_USERNAME and E2E_PASSWORD for a dedicated QA account. ' +
      'The suite refuses to reuse stale or unauthenticated storage state.',
  );
}

/**
 * Local Finance browser contract suite.
 *
 * This suite performs read-only Finance navigation and client-side validation
 * checks using a real authenticated QA session. The setup project logs in
 * through the normal UI using E2E_USERNAME/E2E_PASSWORD and persists the
 * resulting storage state before the Finance matrix starts.
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
  projects: [
    {
      name: 'finance-auth-setup',
      testMatch: /auth\.setup\.ts/,
      use: { baseURL: process.env.FINANCE_BASE_URL || 'http://localhost:3000' },
    },
    {
      name: 'finance-module',
      dependencies: ['finance-auth-setup'],
      testMatch: /finance-module\.browser\.spec\.ts/,
    },
  ],
  webServer: {
    command: 'pnpm run dev -p 3000',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DB_CONNECTION_LIMIT: process.env.DB_CONNECTION_LIMIT || '4',
    },
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
