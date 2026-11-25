import { test, expect, type Browser, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';

/**
 * Role-by-role browser pass of procurement (localhost, ZZTEST data from scripts/zz-gui3.ts setup and addosp):
 *   the Procurement Officer (maker) cannot approve their own purchase order, the OSP Manager approves it, the maker issues it to the vendor,
 *   the Stores Executive's goods receipt is booked (scripts/zz-gui3.ts step2), the maker enters the supplier invoice on the Supplier Invoices screen
 *   (3-way match), cannot approve it, and the Finance Manager approves it.
 * Env: GUI3_PASSWORD, GUI3_PO (the order number).
 */
const PASSWORD = process.env.GUI3_PASSWORD ?? '';
const PO = process.env.GUI3_PO ?? '';

async function signIn(browser: Browser, username: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="password"]', { timeout: 60_000 });
  await page.waitForTimeout(6000); // let the page finish hydrating, or the typed text is cleared when React takes over
  const user = page.locator('#login-username');
  const pass = page.locator('input[type="password"]').first();
  for (let attempt = 0; attempt < 5; attempt++) { // type, and check that the text stayed (the form can be reset while the page is still starting)
    await user.fill(username);
    await pass.fill(PASSWORD);
    if ((await user.inputValue()) === username && (await pass.inputValue()) === PASSWORD) break;
    await page.waitForTimeout(3000);
  }
  await page.locator('#login-submit-btn').click();
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 60_000 }).not.toMatch(/\/login$/);
  return page;
}

/** The card of one purchase order on the Order Processing screen. */
async function orderCard(page: Page) {
  await page.goto('/procurement/orders', { waitUntil: 'domcontentloaded' });
  // an order that exists (approved or not yet) is under "In progress"; "Pending PO" lists approved requests that still wait for an order
  await page.getByText(/^in progress$/i).first().click({ timeout: 240_000 });
  const row = page.locator('tr', { hasText: PO });
  await row.waitFor({ timeout: 240_000 });
  // the order's buttons are in the part that opens with the eye icon of its row
  if (!(await page.getByTestId('po-status').count())) await row.locator('button').first().click();
  await page.getByTestId('po-status').first().waitFor({ timeout: 120_000 });
  return page.locator('div').filter({ hasText: PO }).filter({ has: page.getByTestId('po-status') }).last();
}

test('purchase order and supplier invoice, by the real roles', async ({ browser }) => {
  test.setTimeout(1_500_000);
  expect(PO, 'GUI3_PO must hold the order number').toBeTruthy();

  // 1. the maker sees the order waiting for approval; the approval is refused for the person who raised it
  const maker = await signIn(browser, 'zzg3_proc');
  let card = await orderCard(maker);
  await expect(card.getByTestId('po-status')).toContainText(/PENDING APPROVAL/);
  await card.getByTestId('po-approve').click();
  await maker.waitForTimeout(8000);
  card = await orderCard(maker);
  await expect(card.getByTestId('po-status'), 'the maker must not be able to approve their own order').toContainText(/PENDING APPROVAL/);
  console.log('MAKER_APPROVE_RESULT', JSON.stringify((await maker.locator('[data-sonner-toast]').allInnerTexts()).slice(0, 3)));

  // 2. a different person who holds the procurement capability approves
  const approver = await signIn(browser, 'zzg3_osp');
  card = await orderCard(approver);
  await expect(card.getByTestId('po-approve')).toBeVisible();
  await card.getByTestId('po-approve').click();
  await approver.waitForTimeout(10_000);
  card = await orderCard(approver);
  console.log('AFTER_APPROVE_STATUS', JSON.stringify(await card.getByTestId('po-status').innerText()));
  await expect(card.getByTestId('po-status')).toContainText(/APPROVED/, { timeout: 60_000 });
  await approver.context().close();

  // 3. the maker issues it to the vendor
  card = await orderCard(maker);
  await card.getByTestId('po-issue').click();
  await maker.waitForTimeout(10_000);
  card = await orderCard(maker);
  await expect(card.getByTestId('po-status')).toContainText(/ISSUED/, { timeout: 60_000 });

  // 4. goods are received by the Stores Executive (the receiving screen was covered by the inventory pass)
  execFileSync('pnpm', ['exec', 'tsx', 'scripts/zz-gui3.ts', 'step2'], { stdio: 'inherit', shell: true });

  // 5. the maker enters the supplier invoice
  await maker.goto('/procurement/invoices', { waitUntil: 'domcontentloaded' });
  const poSelect = maker.getByTestId('inv-po');
  await poSelect.waitFor({ timeout: 240_000 });
  await expect.poll(async () => (await poSelect.locator('option').allInnerTexts()).some((t) => t.includes(PO)), { timeout: 120_000 }).toBeTruthy();
  const value = await poSelect.locator('option', { hasText: PO }).first().getAttribute('value');
  await poSelect.selectOption(value!);
  await maker.waitForTimeout(6000);
  await maker.getByTestId('inv-number').fill(`${PO}-GUI-INV`);
  await maker.getByTestId('inv-submit').click();
  const row = maker.getByTestId('inv-row').filter({ hasText: `${PO}-GUI-INV` });
  await row.waitFor({ timeout: 120_000 });
  console.log('INVOICE_ROW', JSON.stringify((await row.innerText()).replace(/\s+/g, ' ')));
  await expect(row.getByTestId('inv-match')).toContainText(/MATCHED/);

  // 6. the person who entered the invoice cannot approve it; the Finance Manager can
  if (await row.getByTestId('inv-approve').count()) {
    await row.getByTestId('inv-approve').click();
    await maker.waitForTimeout(8000);
    console.log('MAKER_INVOICE_APPROVE_TOAST', JSON.stringify((await maker.locator('[data-sonner-toast]').allInnerTexts()).slice(0, 3)));
    await maker.reload({ waitUntil: 'domcontentloaded' });
    await expect(maker.getByTestId('inv-row').filter({ hasText: `${PO}-GUI-INV` }).getByTestId('inv-status')).not.toContainText(/APPROVED/, { timeout: 120_000 });
  }
  await maker.context().close();

  const finance = await signIn(browser, 'zzg3_fm');
  await finance.goto('/procurement/invoices', { waitUntil: 'domcontentloaded' });
  const frow = finance.getByTestId('inv-row').filter({ hasText: `${PO}-GUI-INV` });
  await frow.waitFor({ timeout: 240_000 });
  await frow.getByTestId('inv-approve').click();
  // the approval posts the vendor payable: over a slow database it takes a while, so reload until the status changes
  await expect.poll(async () => {
    await finance.waitForTimeout(8000);
    await finance.reload({ waitUntil: 'domcontentloaded' });
    const r = finance.getByTestId('inv-row').filter({ hasText: `${PO}-GUI-INV` });
    await r.waitFor({ timeout: 240_000 });
    return r.getByTestId('inv-status').innerText();
  }, { timeout: 300_000 }).toMatch(/APPROVED/);
});
