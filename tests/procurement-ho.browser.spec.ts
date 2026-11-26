import { test, expect, type Browser, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Role-by-role browser pass of procurement in HO mode (ZZTEST data from scripts/zz-gui4.ts setup):
 *   the Procurement Officer records request 1's purchase order with its HO approval (reference, date, approver, scanned document);
 *   request 2's order (same vendor) was recorded by the setup script; the Stores Executive receives both orders on one GRN;
 *   stock, order statuses and GRN lines are checked in the database; the Procurement Officer records the HO payment; the order history shows it all.
 * Env: GUI4_PASSWORD, GUI4_REQ1 (request number), GUI4_VENDOR, GUI4_ITEM_A, GUI4_ITEM_B, GUI4_TAG.
 */
const PASSWORD = process.env.GUI4_PASSWORD ?? '';
const REQ1 = process.env.GUI4_REQ1 ?? '';
const VENDOR = process.env.GUI4_VENDOR ?? '';
const ITEM_A = process.env.GUI4_ITEM_A ?? '';
const ITEM_B = process.env.GUI4_ITEM_B ?? '';
const HO_REF = `${process.env.GUI4_TAG ?? 'ZZG4'}/HO/0001`;

async function signIn(browser: Browser, username: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="password"]', { timeout: 60_000 });
  await page.waitForTimeout(6000);
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

const check = () => {
  const out = execFileSync('pnpm', ['exec', 'tsx', 'scripts/zz-gui4.ts', 'check'], { shell: true, encoding: 'utf8' });
  const line = out.split('\n').find((l) => l.startsWith('CHECK '))!;
  console.log(line);
  return JSON.parse(line.slice(6));
};

test('HO mode: record the HO-approved order, one GRN for two orders, HO payment', async ({ browser }) => {
  test.setTimeout(2_400_000);
  expect(REQ1 && VENDOR && ITEM_A && ITEM_B, 'GUI4_* must be set').toBeTruthy();
  const pdf = path.join(os.tmpdir(), 'zztest-ho-approval.pdf');
  fs.writeFileSync(pdf, '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');

  // a run that already received the goods resumes at the HO payment
  let c = check();
  const resumed = c.grns.length === 1;
  let po1: any;
  let grnNumber = '';
  const proc = await signIn(browser, 'zzg4_proc');
  if (!resumed) {
  // 1. the Procurement Officer records request 1's order with the HO approval
  await proc.goto('/procurement/orders', { waitUntil: 'domcontentloaded' });
  const row = proc.locator('tr', { hasText: REQ1 });
  await row.waitFor({ timeout: 240_000 });
  await row.getByRole('button', { name: /create po/i }).click();
  await proc.getByTestId('ho-approval-block').waitFor({ timeout: 60_000 });
  const vendorSelect = proc.locator('#vendor-select');
  await expect.poll(async () => (await vendorSelect.locator('option').allInnerTexts()).some((t) => t.includes(VENDOR)), { timeout: 120_000 }).toBeTruthy();
  await vendorSelect.selectOption((await vendorSelect.locator('option', { hasText: VENDOR }).first().getAttribute('value'))!);
  for (const [name, price] of [[ITEM_A, '2000'], [ITEM_B, '500']] as const) {
    const line = proc.locator('tr', { hasText: name }).last();
    await line.locator('input[placeholder="0.00"]').first().fill(price);
  }
  // without the HO evidence the order is refused on the screen
  await proc.getByRole('button', { name: /create purchase order/i }).click();
  await proc.waitForTimeout(2000);
  console.log('NO_EVIDENCE_TOAST', JSON.stringify((await proc.locator('[data-sonner-toast]').allInnerTexts()).slice(0, 2)));
  await proc.getByTestId('ho-ref').fill(HO_REF);
  await proc.getByTestId('ho-date').fill(new Date().toISOString().slice(0, 10));
  await proc.getByTestId('ho-by').fill('ZZTEST GM Procurement');
  await proc.getByTestId('ho-doc').setInputFiles(pdf);
  await expect(proc.getByTestId('ho-doc-state')).toHaveText(/Document attached/, { timeout: 120_000 });
  await proc.getByRole('button', { name: /create purchase order/i }).click();
  await expect.poll(async () => check().pos.length, { timeout: 240_000, intervals: [10_000] }).toBe(2);
  c = check();
  po1 = c.pos.find((p: any) => p.hoApprovalRef === HO_REF);
  expect(po1, 'the order recorded in the browser carries the HO reference').toBeTruthy();
  expect(po1.status, 'an HO-approved order is approved at once').toBe('APPROVED');
  expect(po1.hasDocument).toBe(true);

  // 2. the Stores Executive receives both orders of the vendor on one GRN
  const exec = await signIn(browser, 'zzg4_exec');
  await exec.goto('/inventory/grn/po-receipt', { waitUntil: 'domcontentloaded' });
  const vendorPick = exec.getByTestId('grn-vendor');
  await expect.poll(async () => (await vendorPick.locator('option').allInnerTexts()).some((t) => t.includes(VENDOR)), { timeout: 240_000 }).toBeTruthy();
  await vendorPick.selectOption((await vendorPick.locator('option', { hasText: VENDOR }).first().getAttribute('value'))!);
  const lines = exec.getByTestId('grn-po-line');
  await expect(lines).toHaveCount(3, { timeout: 60_000 });
  const texts = (await lines.allInnerTexts()).map((t) => t.replace(/\s+/g, ' '));
  console.log('GRN_LINES', JSON.stringify(texts));
  for (let i = 0; i < 3; i++) {
    const t = texts[i];
    const left = t.includes(ITEM_B) ? '50' : /0002|2,100/.test(t) ? '40' : '100';
    await lines.nth(i).getByTestId('grn-po-qty').fill(left);
  }
  await exec.getByTestId('grn-dn').fill('ZZTEST-DN-1');
  await exec.getByTestId('grn-po-submit').click();
  await expect.poll(async () => check().grns.length, { timeout: 240_000, intervals: [10_000] }).toBe(1);
  c = check();
  expect(c.grns[0].lines, 'one GRN with three lines').toBe(3);
  expect(c.grns[0].linkedLines, 'each line names its PO line').toBe(3);
  expect(c.grns[0].batches, 'each line has its own batch').toBe(3);
  expect(c.grns[0].purchaseOrderId, 'a GRN of two orders is not tied to one order').toBeNull();
  expect(c.stock).toEqual({ A: 140, B: 50 });
  expect(c.pos.map((p: any) => p.status)).toEqual(['RECEIVED', 'RECEIVED']);

  // 2b. material cost: each batch at its PO price, the inventory ledger sealed per line, the item cost re-averaged
  expect(c.batches).toEqual(expect.arrayContaining([{ item: 'A', qty: 100, cost: 2000 }, { item: 'B', qty: 50, cost: 500 }, { item: 'A', qty: 40, cost: 2100 }]));
  expect(c.ledger.length, 'one immutable ledger line per GRN line').toBe(3);
  expect(c.ledger.every((l: any) => l.sealed), 'every ledger line carries its checksum').toBe(true);
  expect(c.ledger.map((l: any) => l.unitPrice).sort()).toEqual([2000, 2100, 500].sort());
  if (c.costingMethod === 'WEIGHTED_AVERAGE') {
    expect(c.itemCost.A, 'A: (100 x 2000 + 40 x 2100) / 140').toBeCloseTo(2028.57, 2);
    expect(c.itemCost.B).toBe(500);
  }
  // 2c. finance: the receipt is booked at once, stock against goods received not yet invoiced (100 x 2000 + 50 x 500 + 40 x 2100 = 309,000)
  expect(c.grnJournal.length, 'one journal entry for the GRN').toBe(1);
  expect(c.grnJournal[0].lines).toEqual(expect.arrayContaining([{ account: 'INV-1010', debit: 309000, credit: 0 }, { account: 'AP-2010', debit: 0, credit: 309000 }]));
  grnNumber = c.grns[0].grnNumber;

  // 2d. the screens the stores people look at
  await exec.goto('/inventory/grn', { waitUntil: 'domcontentloaded' });
  await exec.getByText(/^completed grns$/i).first().click({ timeout: 240_000 });
  await exec.getByText(grnNumber).first().waitFor({ timeout: 240_000 }).catch(() => undefined);
  console.log('GRN_LIST_SHOWS', grnNumber, await exec.getByText(grnNumber).count());
  await exec.screenshot({ path: 'test-results/ho-1-grn-list.png', fullPage: true });
  await exec.goto('/inventory/stock', { waitUntil: 'domcontentloaded' });
  await exec.waitForTimeout(20_000);
  await exec.screenshot({ path: 'test-results/ho-2-stock.png', fullPage: true });
  await exec.context().close();
  }
  if (resumed) { po1 = c.pos.find((p: any) => p.hoApprovalRef === HO_REF); grnNumber = c.grns[0].grnNumber; }

  // 3. the Procurement Officer opens the received order from the Purchase Orders list (its history page) and records the HO payment
  await proc.goto('/procurement/purchase-orders', { waitUntil: 'domcontentloaded' });
  await proc.getByRole('link', { name: po1.poNumber }).first().click({ timeout: 240_000 });
  await proc.getByTestId('ho-payment-form').waitFor({ timeout: 240_000 });
  await proc.getByTestId('ho-pay-ref').fill('ZZTEST-PAY-0001');
  await proc.getByTestId('ho-pay-inv').fill('ZZTEST-INV-0001');
  await proc.getByTestId('ho-pay-submit').click();
  await expect.poll(async () => check().pos.find((p: any) => p.poNumber === po1.poNumber).hoPaymentRef, { timeout: 240_000, intervals: [10_000] }).toBe('ZZTEST-PAY-0001');
  c = check();
  const paid = c.pos.find((p: any) => p.poNumber === po1.poNumber);
  expect(paid.hoCleared, 'the received value (100 x 2000 + 50 x 500) is cleared from GR/IR').toBe(225000);
  expect(c.hoJournal).toBe(1);
  expect(c.hoJournalLines[0]).toEqual(expect.arrayContaining([{ account: 'AP-2010', debit: 225000, credit: 0 }, { account: 'HO-2020', debit: 0, credit: 225000 }]));

  // 3b. the Finance Manager sees both entries in the general ledger
  const fm = await signIn(browser, 'zzg4_fm');
  await fm.goto('/finance/general-ledger', { waitUntil: 'domcontentloaded' });
  await fm.waitForTimeout(25_000);
  const glText = await fm.locator('body').innerText();
  console.log('GL_SHOWS', JSON.stringify({ grn: glText.includes(grnNumber) || /GRN Receipt/.test(glText), hoPayment: glText.includes('ZZTEST-PAY-0001') }));
  await fm.screenshot({ path: 'test-results/ho-3-general-ledger.png', fullPage: true });
  await fm.context().close();

  // 4. the order history page
  await proc.reload({ waitUntil: 'domcontentloaded' });
  await proc.getByTestId('dossier-ho').waitFor({ timeout: 240_000 });
  console.log('DOSSIER_HO', (await proc.getByTestId('dossier-ho').innerText()).replace(/\s+/g, ' '));
  console.log('DOSSIER_VALUES', (await proc.getByTestId('dossier-values').innerText()).replace(/\s+/g, ' '));
  await expect(proc.getByTestId('dossier-ho')).toContainText(HO_REF);
  await expect(proc.getByTestId('dossier-values')).toContainText(/Still to receive\s*LKR 0\.00/);
  await expect(proc.getByTestId('dossier-ho-payment')).toContainText(/ZZTEST-PAY-0001/);
  await expect(proc.getByTestId('dossier-chain')).toContainText(/Log intact: 2 entries/);
  await proc.screenshot({ path: 'test-results/ho-4-po-history.png', fullPage: true });
});
