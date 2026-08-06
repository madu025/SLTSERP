import { defineConfig, devices } from '@playwright/test';

/**
 * QA Agent Playwright configuration.
 *
 * Isolated from the root playwright.config.ts so module-by-module QA runs
 * don't collide with the existing e2e pipeline (which uses storageState
 * auth and its own testDir). This config logs in fresh for every test
 * through the loginAs helper so role-based isolation is explicit.
 */
export default defineConfig({
    testDir: '..',
    testMatch: /.*\.spec\.ts$/,
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: 0,         // We want to catch first-run failures, not retry flakiness
    workers: 1,         // Sequential to avoid DB mutation collisions
    reporter: [
        ['list'],
        ['json', { outputFile: '../reports/results.json' }],
        ['html', { outputFolder: '../reports/html', open: 'never' }],
    ],
    timeout: 30_000,
    expect: { timeout: 10_000 },

    use: {
        baseURL: process.env.BASE_URL || 'http://localhost:3000',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'off',
        actionTimeout: 10_000,
        navigationTimeout: 15_000,
    },

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],

    // Do NOT auto-start the server here — assume `npm run dev` is already
    // running. This avoids port conflicts with the existing config.
});
