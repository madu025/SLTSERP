import { test, expect } from '@playwright/test';

const smokeUsername = process.env.SMOKE_TEST_USERNAME;
const smokePassword = process.env.SMOKE_TEST_PASSWORD;
const requireAuth = process.env.SMOKE_REQUIRE_AUTH === 'true';

test.describe.configure({ mode: 'serial' });

test('liveness endpoint is available', async ({ request }) => {
  const response = await request.get('/api/health/live');

  expect(response.status()).toBe(200);
  const body = await response.json() as { status?: string };
  expect(body.status).toBe('ok');
});

test('application health reports a live database', async ({ request }) => {
  const response = await request.get('/api/health');

  // The health contract may return 503 when the read-only sync census proves the
  // worker tier fully stale. That is distinct from a database outage, which is
  // the dependency this smoke test is intended to verify.
  const body = await response.json() as { services?: { database?: string } };
  expect([200, 503]).toContain(response.status());
  expect(body.services?.database).toBe('healthy');
});

test('login page is reachable and exposes the expected form', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('#login-username')).toBeVisible();
  await expect(page.locator('#login-password')).toBeVisible();
  await expect(page.locator('#login-submit-btn')).toBeVisible();
});

test('dedicated smoke account can establish a read-only session', async ({ page }) => {
  if (!smokeUsername || !smokePassword) {
    if (requireAuth) {
      throw new Error(
        'SMOKE_TEST_USERNAME and SMOKE_TEST_PASSWORD are required for the production smoke gate.',
      );
    }
    test.skip(true, 'No smoke credentials supplied; public smoke checks still ran.');
    return;
  }

  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.fill('#login-username', smokeUsername);
  await page.fill('#login-password', smokePassword);

  const loginResponse = page.waitForResponse((response) => response.url().includes('/api/login'));
  await page.click('#login-submit-btn');
  expect((await loginResponse).status()).toBe(200);

  await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 30_000 });

  // Read-only session verification. This suite must never create or mutate business data.
  const profileResponse = await page.request.get('/api/profile');
  expect(profileResponse.status()).toBe(200);
});
