import { test as setup } from '@playwright/test';

const AUTH_FILE = '.auth/user.json';

setup('authenticate as admin user', async ({ page }) => {
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

  // Fill credentials using known IDs from the login page
  await page.fill('#login-username', 'admin');
  await page.fill('#login-password', 'Admin@123');

  // Click the submit button
  await page.click('#login-submit-btn');

  // Wait for navigation to dashboard (timeout after 15s)
  try {
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    console.log('Login successful, redirected to dashboard');
  } catch {
    console.log('Login redirect check - current URL:', page.url());
    // Take a screenshot to debug
    await page.screenshot({ path: 'test-results/auth-login-result.png' });
  }

  // Save authenticated state
  await page.context().storageState({ path: AUTH_FILE });
  console.log('Authentication state saved to', AUTH_FILE);
});
