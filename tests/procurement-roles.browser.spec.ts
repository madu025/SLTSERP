import { test, expect, type Browser, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';

/**
 * Role-by-role browser pass of the purchase order approval chain (ZZTEST data from scripts/zz-gui3.ts setup):
 *   the Procurement Officer raises an order above 5M; it needs step 1 OSP Manager, step 2 Head of OSP, step 3 Finance Manager.
 *   The maker and a later-step approver cannot act on step 1; the Head of OSP returns it with remarks (one step back) and it is approved again;
 *   the maker issues it, goods are received (scripts/zz-gui3.ts step2), the maker enters the supplier invoice, the Finance Manager approves it,
 *   it waits for the CEO (above the 5M threshold), the CEO approves it, and the order's history page shows every step with an intact log.
 * Env: GUI3_PASSWORD, GUI3_PO (order number), GUI3_POID (order id).
 */
const PASSWORD = process.env.GUI3_PASSWORD ?? '';
const PO = process.env.GUI3_PO ?? '';
const POID = process.env.GUI3_POID ?? '';
const INV = `${PO}-GUI-INV`;
/** Resume a run from a later step (the order already moved that far): 1 = from the start, 6 = from the Finance Manager's step 3. */
const FROM = Number(process.env.GUI3_FROM ?? 1);

async function signIn(browser: Browser, username: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="password"]', { timeout: 60_000 });
  await page.waitForTimeout(6000); // let the page finish hydrating, or the typed text is cleared when React takes over
  const user = page.locator('#login-username');
  const pass = page.locator('input[type="password"]').first();
  for (let attempt = 0; attempt < 5; attempt++) {
    await user.fill(username);
    await pass.fill(PASSWORD);
    if ((await user.inputValue()) === username && (await pass.inputValue()) === PASSWORD) break;
    await page.waitForTimeout(3000);
  }
  await page.locator('#login-submit-btn').click();
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 60_000 }).not.toMatch(/\/login$/);
  return page;
}

/** The card of the order on the Order Processing screen ("In progress" tab, opened with the eye icon of its row). */
async function orderCard(page: Page) {
  await page.goto('/procurement/orders', { waitUntil: 'domcontentloaded' });
  await page.getByText(/^in progress$/i).first().click({ timeout: 240_000 });
  const row = page.locator('tr', { hasText: PO });
  await row.waitFor({ timeout: 240_000 });
  if (!(await page.getByTestId('po-status').count())) await row.locator('button').first().click();
  await page.getByTestId('po-status').first().waitFor({ timeout: 120_000 });
  return page.locator('div').filter({ hasText: PO }).filter({ has: page.getByTestId('po-status') }).last();
}

async function statusOf(page: Page) {
  return (await (await orderCard(page)).getByTestId('po-status').innerText()).replace(/\s+/g, ' ');
}

/** Clicks an action on the order and waits until the status text changes away from what it was (or the wait runs out, for refused actions). */
async function act(page: Page, testId: string, opts: { prompt?: string; expectChange: boolean }) {
  const before = await statusOf(page);
  const card = await orderCard(page);
  if (opts.prompt !== undefined) page.once('dialog', (d) => d.accept(opts.prompt));
  await card.getByTestId(testId).click();
  await page.waitForTimeout(9000);
  const toasts = (await page.locator('[data-sonner-toast]').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ')).slice(0, 2);
  let after = await statusOf(page);
  if (opts.expectChange) {
    for (let i = 0; i < 8 && after === before; i++) { await page.waitForTimeout(8000); after = await statusOf(page); }
  }
  console.log(`ACTION ${testId}: "${before}" -> "${after}" toasts=${JSON.stringify(toasts)}`);
  return { before, after, toasts };
}

async function invoiceStatus(page: Page) {
  await page.goto('/procurement/invoices', { waitUntil: 'domcontentloaded' });
  const r = page.getByTestId('inv-row').filter({ hasText: INV });
  await r.waitFor({ timeout: 240_000 });
  return { row: r, status: (await r.getByTestId('inv-status').innerText()).trim() };
}

test('purchase order approval chain and executive invoice approval, by the real roles', async ({ browser }) => {
  test.setTimeout(3_000_000);
  expect(PO && POID, 'GUI3_PO and GUI3_POID must be set').toBeTruthy();

  let maker = await signIn(browser, 'zzg3_proc');
  if (FROM <= 5) {
  // 1. the maker sees the order at step 1 and cannot approve it
  expect(await statusOf(maker)).toMatch(/PENDING APPROVAL · Step 1/);
  const m1 = await act(maker, 'po-approve', { expectChange: false });
  expect(m1.after, 'the maker must not approve the order').toMatch(/Step 1/);

  // 2. the Head of OSP (step 2) cannot sign step 1
  const hosp = await signIn(browser, 'zzg3_hosp');
  const h1 = await act(hosp, 'po-approve', { expectChange: false });
  expect(h1.after, 'a later-step approver cannot sign step 1').toMatch(/Step 1/);

  // 3. the OSP Manager signs step 1
  const osp = await signIn(browser, 'zzg3_osp');
  expect((await act(osp, 'po-approve', { expectChange: true })).after).toMatch(/Step 2/);

  // 4. the Head of OSP returns it with remarks: one step back
  expect((await act(hosp, 'po-return', { prompt: 'ZZTEST: please confirm the drop wire price', expectChange: true })).after).toMatch(/Step 1/);

  // 5. the OSP Manager signs step 1 again (allowed after a return), the Head of OSP signs step 2
  expect((await act(osp, 'po-approve', { expectChange: true })).after).toMatch(/Step 2/);
  await osp.context().close();
  expect((await act(hosp, 'po-approve', { expectChange: true })).after).toMatch(/Step 3/);
  await hosp.context().close();
  }

  // 6. the Finance Manager signs step 3: the order is approved
  const fm = await signIn(browser, 'zzg3_fm');
  expect((await act(fm, 'po-approve', { expectChange: true })).after).toMatch(/^APPROVED/);

  // 7. the maker issues it to the vendor
  expect((await act(maker, 'po-issue', { expectChange: true })).after).toMatch(/ISSUED/);

  // 8. goods are received by the Stores Executive (the receiving screen was covered by the inventory pass)
  execFileSync('pnpm', ['exec', 'tsx', 'scripts/zz-gui3.ts', 'step2'], { stdio: 'inherit', shell: true });

  // 9. the maker enters the supplier invoice (above 5M)
  await maker.goto('/procurement/invoices', { waitUntil: 'domcontentloaded' });
  const poSelect = maker.getByTestId('inv-po');
  await poSelect.waitFor({ timeout: 240_000 });
  await expect.poll(async () => (await poSelect.locator('option').allInnerTexts()).some((t) => t.includes(PO)), { timeout: 120_000 }).toBeTruthy();
  await poSelect.selectOption((await poSelect.locator('option', { hasText: PO }).first().getAttribute('value'))!);
  await maker.waitForTimeout(6000);
  await maker.getByTestId('inv-number').fill(INV);
  await maker.getByTestId('inv-submit').click();
  const row = maker.getByTestId('inv-row').filter({ hasText: INV });
  await row.waitFor({ timeout: 120_000 });
  console.log('INVOICE_ROW', JSON.stringify((await row.innerText()).replace(/\s+/g, ' ')));
  await expect(row.getByTestId('inv-match')).toContainText(/MATCHED/);
  await maker.context().close();

  // 10. the Finance Manager approves: above the threshold it now waits for the CEO
  let inv = await invoiceStatus(fm);
  await inv.row.getByTestId('inv-approve').click();
  await expect.poll(async () => { await fm.waitForTimeout(8000); return (await invoiceStatus(fm)).status; }, { timeout: 300_000 }).toMatch(/AWAITING CEO APPROVAL/);
  // the same Finance Manager cannot give the second approval
  inv = await invoiceStatus(fm);
  await inv.row.getByTestId('inv-approve').click();
  await fm.waitForTimeout(9000);
  console.log('FM_SECOND_APPROVE_TOAST', JSON.stringify((await fm.locator('[data-sonner-toast]').allInnerTexts()).slice(0, 2)));
  expect((await invoiceStatus(fm)).status, 'the finance approver cannot also give the executive approval').toMatch(/AWAITING CEO APPROVAL/);
  await fm.context().close();

  // 11. the CEO approves: the invoice is approved (and posted)
  const ceo = await signIn(browser, 'zzg3_ceo');
  inv = await invoiceStatus(ceo);
  await inv.row.getByTestId('inv-approve').click();
  await expect.poll(async () => { await ceo.waitForTimeout(8000); return (await invoiceStatus(ceo)).status; }, { timeout: 300_000 }).toMatch(/^APPROVED$/);

  // 12. the order's history page: every step with its remarks, an intact log, and both invoice approvals
  await ceo.goto(`/procurement/orders/${POID}`, { waitUntil: 'domcontentloaded' });
  await ceo.getByTestId('dossier-chain').waitFor({ timeout: 240_000 });
  const chainText = await ceo.getByTestId('dossier-chain').innerText();
  const steps = (await ceo.getByTestId('dossier-approval').allInnerTexts()).map((t) => t.replace(/\s+/g, ' '));
  const invoiceText = (await ceo.getByTestId('dossier-invoice').first().innerText()).replace(/\s+/g, ' ');
  console.log('DOSSIER_CHAIN', chainText);
  console.log('DOSSIER_STEPS', JSON.stringify(steps));
  console.log('DOSSIER_INVOICE', invoiceText);
  expect(chainText).toMatch(/Log intact: 6 entries/);
  expect(steps.some((s) => /Returned with remarks/.test(s) && /confirm the drop wire price/.test(s))).toBeTruthy();
  expect(invoiceText).toMatch(/finance approval ZZG3 fm/);
  expect(invoiceText).toMatch(/final approval ZZG3 ceo/);
});
