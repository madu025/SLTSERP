import { test as setup } from '@playwright/test';

const AUTH_FILE = '.auth/user.json';
const E2E_USERNAME = process.env.E2E_USERNAME;
const E2E_PASSWORD = process.env.E2E_PASSWORD;

setup('authenticate as configured E2E user', async ({ page }) => {
  if (!E2E_USERNAME || !E2E_PASSWORD) {
    throw new Error(
      'E2E_USERNAME and E2E_PASSWORD must be provided. Use a dedicated non-production test account; credentials are never stored in source code.',
    );
  }

  // Go to login page - use load instead of networkidle since Next.js dev server
  // has persistent HMR WebSocket connections
  await page.goto('/login', { waitUntil: 'domcontentloaded' });

  // Wait for React hydration
  await page.waitForTimeout(2000);

  // Check if already authenticated (redirected away from login)
  if (!page.url().includes('/login')) {
    console.log('Already authenticated, saving storage state...');
    await page.context().storageState({ path: AUTH_FILE });
    return;
  }

  // Fill credentials from the CI/local environment, never from source code.
  await page.fill('#login-username', E2E_USERNAME);
  await page.fill('#login-password', E2E_PASSWORD);

  // Click the submit button
  await page.click('#login-submit-btn');

  // Wait for navigation to dashboard (timeout after 15s)
  try {
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    console.log('Login successful, redirected to dashboard');
  } catch (error) {
    await page.screenshot({ path: 'test-results/auth-login-result.png' });
    throw new Error(`E2E login did not reach the dashboard (current URL: ${page.url()})`, { cause: error });
  }

  // Save authenticated state
  await page.context().storageState({ path: AUTH_FILE });
  console.log('Authentication state saved to', AUTH_FILE);
});
