import { Page, Response } from '@playwright/test';
import { loginAs, logout, TestRole, LoginResult } from './fixtures';

/* ── Types ── */

export interface ConsoleError {
    readonly text: string;
    readonly location?: string;
}

export interface FailedRequest {
    readonly url: string;
    readonly method: string;
    readonly status: number;
    readonly snippet?: string;  // first 200 chars of response body
}

export interface PageLoadResult {
    readonly consoleErrors: ConsoleError[];
    readonly failedRequests: FailedRequest[];
}

/* ── Collection helpers ── */

/**
 * Listen to console + network, then reload the page and return everything
 * that went wrong. Uses reload() (not goto) so we capture the same
 * request set a real user would see on refresh.
 */
export async function collectOnReload(page: Page): Promise<PageLoadResult> {
    const consoleErrors: ConsoleError[] = [];
    const failedRequests: FailedRequest[] = [];

    page.on('console', (msg) => {
        if (msg.type() === 'error') {
            consoleErrors.push({
                text: msg.text(),
                location: msg.location().url || undefined,
            });
        }
    });

    page.on('response', async (response: Response) => {
        const status = response.status();
        if (status >= 400) {
            let snippet: string | undefined;
            try {
                const body = await response.text();
                snippet = body.slice(0, 200);
            } catch {
                snippet = '<unreadable body>';
            }
            failedRequests.push({
                url: response.url(),
                method: response.request().method(),
                status,
                snippet,
            });
        }
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    // Allow async client-side fetches to settle without relying on networkidle
    // (which hangs under Next.js dev HMR websockets).
    await page.waitForTimeout(2_000);
    return { consoleErrors, failedRequests };
}

/* ── Role isolation ── */

/**
 * Verify that a forbidden role either sees a 403-style UI ("Forbidden",
 * "Access denied") or gets redirected away from the target path.
 *
 * Returns `loginResult` alongside the forbidden check so callers can
 * skip on rate-limit / login failure.
 */
export async function checkRoleForbidden(
    page: Page,
    path: string,
    role: TestRole,
): Promise<{ forbidden: boolean; evidence: string; login: LoginResult }> {
    await logout(page);
    const login = await loginAs(page, role);

    // If login itself failed, we can't test role isolation — report as
    // "not forbidden" but the caller should skip based on login state.
    if (login.rateLimited || login.loginFailed) {
        return {
            forbidden: false,
            evidence: `Login unavailable for ${role}: rateLimited=${login.rateLimited}, loginFailed=${login.loginFailed}`,
            login,
        };
    }

    const response = await page.goto(path, { waitUntil: 'domcontentloaded' });

    // Case 1: server returned 403
    if (response && response.status() === 403) {
        return { forbidden: true, evidence: `HTTP 403`, login };
    }

    // Case 2: page rendered with a clear "Forbidden" / "Access denied" message
    const body = await page.locator('body').innerText().catch(() => '');
    if (/forbidden|access denied|not authorized/i.test(body)) {
        return { forbidden: true, evidence: `UI shows forbidden message`, login };
    }

    // Case 3: redirect away from the target path (e.g., back to dashboard/login)
    if (!page.url().includes(path)) {
        return { forbidden: true, evidence: `Redirected to ${page.url()}`, login };
    }

    return {
        forbidden: false,
        evidence: `Role ${role} reached ${path} (status ${response?.status()})`,
        login,
    };
}

/* ── Bug log ── */

export interface BugEntry {
    module: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    step: string;
    title: string;
    evidence: string;
}

const BUG_LOG_PATH = 'tests/qa-agent/reports/bugs.json';

/**
 * Append a bug entry to the JSON-lines log. Each call appends a single line.
 * Intentionally append-only so concurrent tests don't clobber the file.
 */
export async function writeBugEntry(entry: BugEntry): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');
    const full = path.resolve(BUG_LOG_PATH);
    await fs.mkdir(path.dirname(full), { recursive: true });
    const line = JSON.stringify({ ...entry, at: new Date().toISOString() }) + '\n';
    await fs.appendFile(full, line, 'utf8');
}

/* ── Misc ── */

/**
 * Wait for a specific API response before asserting on the DOM. Avoids
 * the classic "table rendered but empty because the fetch hasn't landed"
 * false negative.
 */
export async function waitForApi(page: Page, urlFragment: string): Promise<Response> {
    return page.waitForResponse(
        (r) => r.url().includes(urlFragment) && r.request().method() === 'GET',
        { timeout: 15_000 },
    );
}
