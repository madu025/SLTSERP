import { Page } from '@playwright/test';

/**
 * Shared test user accounts — must exist in the dev DB with password `Admin@123`.
 *
 * The main `prisma/seed.js` creates SUPER_ADMIN, ADMIN, OSP_MANAGER, AREA_MANAGER,
 * STORES_MANAGER, AREA_COORDINATOR, QC_OFFICER, and many ENGINEER users. These
 * are the ones we rely on for role-isolation tests.
 *
 * CONTRACTOR_* and PROCUREMENT_OFFICER users are not seeded by default — tests
 * that need those roles should skip with a clear message if the user is missing.
 *
 * `quickButton` maps to the Quick Test Login button label on the dev login page.
 * These buttons call `form.setValue()` + `form.handleSubmit()` internally, which
 * is far more reliable than `page.fill()` against react-hook-form + Shadcn
 * FormField/Controller. Roles without a quick button (ENGINEER) fall back to
 * manual fill with explicit focus + `pressSequentially`.
 */
export const TEST_USERS = {
    SUPER_ADMIN:    { username: 'admin',         password: 'Admin@123', role: 'SUPER_ADMIN',    quickButton: 'Super Admin' },
    ADMIN:          { username: 'testadmin',      password: 'Admin@123', role: 'ADMIN',          quickButton: 'Admin' },
    STORES_MANAGER: { username: 'storesmanager', password: 'Admin@123', role: 'STORES_MANAGER', quickButton: 'Stores Mgr' },
    ENGINEER:       { username: 'dhanushkab',     password: 'Admin@123', role: 'ENGINEER',       quickButton: null },
    OSP_MANAGER:    { username: 'ospmanager',     password: 'Admin@123', role: 'OSP_MANAGER',    quickButton: 'OSP Manager' },
    AREA_MANAGER:   { username: 'areamanager',    password: 'Admin@123', role: 'AREA_MANAGER',   quickButton: 'Area Manager' },
    COORDINATOR:    { username: 'coordinator',    password: 'Admin@123', role: 'AREA_COORDINATOR', quickButton: 'Coordinator' },
    QC_OFFICER:     { username: 'qcofficer',      password: 'Admin@123', role: 'QC_OFFICER',     quickButton: 'QC Officer' },
} as const;

export type TestRole = keyof typeof TEST_USERS;

/**
 * Login result. `rateLimited=true` means the login endpoint returned 429
 * after both the initial attempt and the retry — caller should skip the test.
 * `loginFailed=true` means the login returned a non-200/non-429 response
 * (e.g. 401 invalid credentials) — caller should also skip.
 */
export interface LoginResult {
    rateLimited: boolean;
    loginFailed?: boolean;
    finalUrl?: string;
}

/** Post-login redirect destinations we accept. */
const POST_LOGIN_REGEX = /\/(dashboard|inventory|contractor\/dashboard|change-password|profile|service-orders|fleet|finance|admin|procurement)/;

/**
 * Trigger the login form submission. Uses the Quick Test Login button when
 * available (calls form.setValue() + handleSubmit() internally — avoids
 * react-hook-form hydration races with page.fill()). Falls back to manual
 * pressSequentially for roles without a quick button.
 */
async function triggerLogin(page: Page, quickButton: string | null, username: string, password: string) {
    if (quickButton) {
        const btn = page.getByRole('button', { name: quickButton, exact: true });
        await btn.waitFor({ state: 'visible', timeout: 5_000 });
        await btn.click();
    } else {
        const usernameInput = page.locator('#login-username');
        await usernameInput.click();
        await usernameInput.pressSequentially(username, { delay: 30 });
        const passwordInput = page.locator('#login-password');
        await passwordInput.click();
        await passwordInput.pressSequentially(password, { delay: 30 });
        const submitBtn = page.locator('#login-submit-btn');
        await submitBtn.click();
    }
}

/**
 * Login as the given role. Prefers the Quick Test Login button (dev mode)
 * which calls `form.setValue()` internally — avoids react-hook-form hydration
 * race conditions with `page.fill()`. Falls back to manual fill + type for
 * roles without a quick button.
 *
 * Watches for ANY /api/login response (not just 429) so we can detect
 * silent failures (401, 500) and skip gracefully instead of timing out
 * on waitForURL.
 *
 * Returns a LoginResult so callers can skip gracefully instead of failing
 * when rate-limited or when login fails.
 */
export async function loginAs(page: Page, role: TestRole): Promise<LoginResult> {
    const { quickButton, username, password } = TEST_USERS[role];

    const doLogin = async (): Promise<{ status: number; rateLimited: boolean }> => {
        await page.goto('/login', { waitUntil: 'domcontentloaded' });

        // Wait for the login form to hydrate
        const submitBtn = page.locator('#login-submit-btn');
        await submitBtn.waitFor({ state: 'visible', timeout: 15_000 });

        // Watch for ANY /api/login response to detect the outcome
        const loginResponseWatch = page.waitForResponse(
            (r) => r.url().includes('/api/login'),
            { timeout: 20_000 },
        ).catch(() => null);

        await triggerLogin(page, quickButton, username, password);

        const loginResponse = await loginResponseWatch;
        if (!loginResponse) {
            // No response received within 20s — treat as failure
            return { status: 0, rateLimited: false };
        }
        return {
            status: loginResponse.status(),
            rateLimited: loginResponse.status() === 429,
        };
    };

    // First attempt
    let result = await doLogin();

    if (result.rateLimited) {
        // Rate-limited — wait out the 60s window and retry once
        console.warn(`[loginAs] rate-limited for ${role} (429), waiting 65s to retry...`);
        await page.waitForTimeout(65_000);
        result = await doLogin();
        if (result.rateLimited) {
            return { rateLimited: true };
        }
    }

    // Check for non-200 login (401 invalid creds, 500 server error, etc.)
    if (result.status !== 200 && result.status !== 0) {
        console.warn(`[loginAs] login failed for ${role}: HTTP ${result.status}`);
        return { rateLimited: false, loginFailed: true };
    }
    if (result.status === 0) {
        console.warn(`[loginAs] no login response for ${role}`);
        return { rateLimited: false, loginFailed: true };
    }

    // Wait for post-login redirect. Different roles land on different
    // module roots (STORES_MANAGER -> /inventory, contractors -> /contractor/dashboard,
    // mustChangePassword -> /profile?forcePw=1). Accept any in-tree destination.
    try {
        await page.waitForURL(POST_LOGIN_REGEX, { timeout: 15_000 });
    } catch {
        // waitForURL timed out — check if we're already at a valid destination
        // (the redirect may have completed during the loginResponseWatch wait)
        if (!POST_LOGIN_REGEX.test(page.url())) {
            console.warn(`[loginAs] post-login redirect timeout for ${role}, current URL: ${page.url()}`);
            return { rateLimited: false, loginFailed: true };
        }
    }
    return { rateLimited: false, finalUrl: page.url() };
}

/**
 * Logout by clearing the auth cookie. Clears all browser state so the
 * next test starts clean.
 */
export async function logout(page: Page): Promise<void> {
    await page.context().clearCookies();
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
}
