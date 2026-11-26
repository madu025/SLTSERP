import { defineConfig } from '@playwright/test';

/** Role-by-role browser pass of the inventory chain on localhost (the data comes from scripts/zz-gui2.ts; credentials are read from the environment). */
export default defineConfig({
  testDir: './tests',
  testMatch: /(inventory-roles|procurement-roles|procurement-company-flow).browser.spec.ts/,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: process.env.GUI2_BASE_URL || 'http://localhost:3100',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'off',
  },
});
