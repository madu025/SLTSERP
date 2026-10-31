import { test, expect, type Page } from '@playwright/test';

const financeRoutes = [
  ['/finance', /Financial Control Center/i],
  ['/finance/ap/aging', /Accounts Payable Aging/i],
  ['/finance/ar/aging', /Accounts Receivable Aging/i],
  ['/finance/bank/cash-book', /Cash Book.*Bank Ledger/i],
  ['/finance/bank/reconciliation', /Bank Statement Import.*Reconciliation Engine/i],
  ['/finance/bank-reconciliation', /Auto Bank Reconciliation/i],
  ['/finance/banks', /Bank.*Branch Registry/i],
  ['/finance/banks/import', /Bank Data Upload/i],
  ['/finance/billing', /Contractor Billing/i],
  ['/finance/budget', /Budget/i],
  ['/finance/capex-opex', /Capex.*Opex/i],
  ['/finance/chart-of-accounts', /Chart of Accounts/i],
  ['/finance/contractor-payments', /Contractor Payment Configuration/i],
  ['/finance/cost-allocation', /Cost Allocation/i],
  ['/finance/credit-notes', /Credit.*Debit Notes Register/i],
  ['/finance/exchange-rates', /Exchange Rates/i],
  ['/finance/fixed-assets', /Fixed Assets/i],
  ['/finance/fpa-dashboard', /FP&A|Predictive/i],
  ['/finance/general-ledger', /General Ledger/i],
  ['/finance/invoices', /Invoice Approvals/i],
  ['/finance/ld-penalties', /Liquidated Damages|LD Penalties/i],
  ['/finance/osp-account/advances', /Project Advances/i],
  ['/finance/osp-account/fleet', /Fleet Finance Operations/i],
  ['/finance/osp-account/ious', /Petty Cash IOUs/i],
  ['/finance/osp-account/rents', /Property.*Office Rents/i],
  ['/finance/osp-account-reports', /OSP Account Reports/i],
  ['/finance/payments', /Payment Vouchers/i],
  ['/finance/payroll', /Payroll/i],
  ['/finance/period-close', /Financial Period Close/i],
  ['/finance/rate-matrix', /Rate Matrix/i],
  ['/finance/reports/balance-sheet', /Balance Sheet/i],
  ['/finance/reports/gl-viewer', /GL Viewer|General Ledger/i],
  ['/finance/reports/pnl', /Profit.*Loss|P&L/i],
  ['/finance/reports/trial-balance', /Trial Balance/i],
  ['/finance/retention', /Retention/i],
  ['/finance/sf-audit', /Governance|SF Audit/i],
  ['/finance/sf-audit/governance', /Governance/i],
  ['/finance/sf-audit/header-mapping', /Header Mapping/i],
  ['/finance/sf-audit/payment-split-config', /Payment Split/i],
  ['/finance/sf-audit/pricing-audit', /Pricing Audit/i],
  ['/finance/slt-contracts', /SLT Contracts/i],
  ['/finance/sod-revenue', /SOD Revenue/i],
  ['/finance/tax/vat-return', /VAT/i],
  ['/finance/tax/wht-register', /WHT|Withholding/i],
  ['/finance/vendors', /Vendors/i],
  ['/finance/vendors/import', /Vendor.*Import/i],
  ['/finance/wip-revenue', /WIP.*Revenue/i],
  ['/finance/petty-cash', /OSP Account Reports|Petty Cash/i],
] as const;

async function assertHealthyFinancePage(page: Page, route: string, heading: RegExp) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const responseErrors: string[] = [];

  const onConsole = (message: { type(): string; text(): string }) => {
    if (message.type() === 'error' && !message.text().includes('EventSource')) {
      consoleErrors.push(message.text());
    }
  };
  const onPageError = (error: Error) => pageErrors.push(error.message);
  const onResponse = (response: { status(): number; url(): string }) => {
    if (response.status() >= 500 && !response.url().includes('/_next/')) {
      responseErrors.push(`${response.status()} ${response.url()}`);
    }
  };

  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  page.on('response', onResponse);
  try {
    const response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    expect(response?.status(), `${route} initial response`).toBeLessThan(500);
    await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 30_000 });
    await expect(page.locator('body')).toBeVisible();
    await page.waitForTimeout(1200);

    const bodyText = await page.locator('body').innerText();
    expect(bodyText, `${route} must not render a Next.js error boundary`).not.toMatch(
      /Application error|Unhandled Runtime Error|Internal Server Error/i,
    );
    await expect(page.getByRole('heading').filter({ hasText: heading }).first()).toBeVisible({ timeout: 20_000 });
    expect(responseErrors, `${route} server errors`).toEqual([]);
    expect(pageErrors, `${route} page errors`).toEqual([]);
    expect(consoleErrors, `${route} console errors`).toEqual([]);
  } finally {
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
    page.off('response', onResponse);
  }
}

test.describe('Finance module browser route matrix', () => {
  test.describe.configure({ mode: 'serial' });

  for (const [route, heading] of financeRoutes) {
    test(`${route} renders without auth/runtime/server errors`, async ({ page }) => {
      await assertHealthyFinancePage(page, route, heading);
    });
  }
});

test.describe('Finance critical browser interactions', () => {
  test.describe.configure({ mode: 'serial' });

  test('invoice approvals page renders safe empty/loading states', async ({ page }) => {
    await page.goto('/finance/invoices', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Invoice Approvals/i })).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/Application error|Unhandled Runtime Error/i);
  });

  test('credit/debit notes register renders a real status column', async ({ page }) => {
    await page.goto('/finance/credit-notes', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Credit.*Debit Notes Register/i })).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/undefined|Application error|Unhandled Runtime Error/i);
  });

  test('bank reconciliation requires an account and never shows a fake zero fallback', async ({ page }) => {
    await page.goto('/finance/bank/reconciliation', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Bank Statement Import.*Reconciliation Engine/i })).toBeVisible();
    await expect(page.locator('#reconciliation-bank-account')).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/Unable to load|Application error|Unhandled Runtime Error/i);
  });

  test('period close requires an explicit completed year before any action', async ({ page }) => {
    await page.goto('/finance/period-close', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Financial Period Close/i })).toBeVisible();
    const year = page.locator('#period-close-year');
    await expect(year).toBeVisible();
    await expect(page.getByRole('button', { name: /Close Financial Year/i })).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/Application error|Unhandled Runtime Error/i);
  });

  test('finance dashboard loads API-backed metrics without a client error boundary', async ({ page }) => {
    await page.goto('/finance', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Financial Control Center/i })).toBeVisible();
    await page.waitForTimeout(1200);
    await expect(page.locator('body')).not.toContainText(/Application error|Unhandled Runtime Error|Failed to fetch/i);
  });
});
