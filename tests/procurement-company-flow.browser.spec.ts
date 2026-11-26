import { test, expect, type Browser, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * The company procure-to-pay flow, every step on the screens by the real roles, and after each step the next person's notification bell
 * (people, store, item and vendors from `scripts/zz-gui6.ts setup-ui`; run against the deployed site because uploads go to storage):
 *   Stores Officer: material request C-Hook 1000 (local purchase);
 *   Approvals: the OSP Manager cannot sign first; Stores Manager, OSP Manager, Head of Section approve in turn;
 *   Procurement Officer: PO-A (Vendor A 600) and PO-B (Vendor B 400) with the credit days (approved in the HO system); no third PO once all is ordered;
 *     marks the orders sent, confirmed, finished (ready for GRN);
 *   Stores Manager: GRN for PO-A, 550 accepted and 50 rejected with a reason, Oracle GRN number, vendor invoice;
 *   OSP Account Officer: payment voucher; OSP Account Manager, OSP Manager, Head of Section approve it (the invoice is posted at the last);
 *   OSP Account sends the documents, the Procurement Officer marks them received (the voucher goes to HO);
 *   Account Executive at HO: 50,000 then the rest; ledger, invoice and voucher end PAID.
 * Env: GUI6_PASSWORD. The rest is read from the manifest that setup-ui writes.
 */
const PASSWORD = process.env.GUI6_PASSWORD ?? '';
const MANIFEST = 'C:/Users/Prasad/AppData/Local/Temp/claude/e397d143faaeb6c1/cf013f60-1b45-4b69-8da2-52e9230f861d/scratchpad/gui6-manifest.json';
const M = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};
const SHOTS = 'test-results/full-gui';

async function signIn(browser: Browser, username: string): Promise<Page> {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
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
  const out = execFileSync('pnpm', ['exec', 'tsx', 'scripts/zz-gui6.ts', 'check'], { shell: true, encoding: 'utf8' });
  const line = out.split('\n').find((l) => l.startsWith('CHECK '))!;
  return JSON.parse(line.slice(6));
};

/** Opens the person's notification bell (header) and waits until a notice whose title matches is listed; saves a screenshot of the open bell. */
async function bell(page: Page, title: RegExp, shot: string) {
  for (let i = 0; i < 12; i++) {
    await page.reload({ waitUntil: 'domcontentloaded' });
    const button = page.getByRole('button', { name: /^Notifications/ }).first();
    await button.waitFor({ timeout: 120_000 });
    await button.click();
    // the bell opens the notifications panel; a notice is shown by its title, whatever the panel's markup
    const notice = page.getByText(title).first();
    if (await notice.waitFor({ state: 'visible', timeout: 15_000 }).then(() => true).catch(() => false)) {
      await page.screenshot({ path: `${SHOTS}/${shot}.png` });
      console.log(`BELL ${shot}: ${(await notice.innerText()).trim().slice(0, 90)}`);
      await page.keyboard.press('Escape');
      return;
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(10_000);
  }
  await page.screenshot({ path: `${SHOTS}/${shot}-MISSING.png` });
  throw new Error(`${shot}: no notice like ${title} in the bell`);
}

/** The request on the Approvals screen (the process gate queue): returns the row, or null when the person has nothing to sign on it. */
async function approvalsRow(page: Page, requestNr: string, wait = 240_000) {
  await page.goto('/procurement/approvals', { waitUntil: 'domcontentloaded' });
  const row = page.locator('tr', { hasText: requestNr }).first();
  return row.waitFor({ timeout: wait }).then(() => row).catch(() => null);
}

async function approveRequest(page: Page, requestNr: string, shot: string) {
  const row = await approvalsRow(page, requestNr);
  expect(row, `${shot}: the request is in the Approvals queue`).not.toBeNull();
  await row!.getByRole('button').last().click();
  const go = page.getByRole('button', { name: /approve & forward/i });
  await go.waitFor({ timeout: 60_000 });
  await page.screenshot({ path: `${SHOTS}/${shot}.png` });
  await go.click();
}

async function paymentTerms(page: Page, creditDays: string) {
  await expect(page.getByTestId('ho-ref'), 'no HO approval fields on the PO form').toHaveCount(0);
  await page.getByTestId('pay-basis').selectOption('CREDIT');
  await page.getByTestId('credit-days').fill(creditDays);
}

/** Fills the PO line of the C-Hook in the Create PO drawer. */
async function poLine(page: Page, vendor: string, qty: string | null, price: string) {
  const vendorSelect = page.locator('#vendor-select');
  await vendorSelect.waitFor({ timeout: 60_000 });
  const value = await vendorSelect.locator('option', { hasText: vendor }).first().getAttribute('value');
  await vendorSelect.selectOption(value!);
  const line = page.getByRole('dialog').locator('tr', { hasText: M.itemName }).first();
  const inputs = line.locator('input[type="number"]');
  if (qty !== null) await inputs.nth(0).fill(qty);
  await inputs.nth(1).fill(price);
}

test('company flow on the screens: request, approvals, POs, GRN, voucher chain, documents, HO payments, with every bell', async ({ browser }) => {
  test.setTimeout(3_600_000);
  expect(PASSWORD && M.storeName && M.itemName && M.vendorA, 'GUI6_PASSWORD and the setup-ui manifest must be present').toBeTruthy();
  fs.mkdirSync(SHOTS, { recursive: true });
  const pdf = path.join(os.tmpdir(), 'zztest-document.pdf');
  fs.writeFileSync(pdf, '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');

  // 1. the Stores Officer raises the material request: C-Hook 1000, local purchase
  const so = await signIn(browser, 'zzg6_so');
  await so.goto('/inventory/requests/create', { waitUntil: 'domcontentloaded' });
  const storeSelect = so.locator('select', { has: so.locator('option', { hasText: 'Select Store...' }) }).first();
  await storeSelect.locator('option', { hasText: M.storeName }).waitFor({ state: 'attached', timeout: 120_000 });
  await storeSelect.selectOption({ label: M.storeName });
  await so.locator('select', { has: so.locator('option[value="LOCAL_PURCHASE"]') }).first().selectOption('LOCAL_PURCHASE');
  await so.getByRole('button', { name: /add new item line/i }).click();
  const itemSelect = so.locator('select', { has: so.locator('option', { hasText: 'Select Item...' }) }).first();
  await itemSelect.locator('option', { hasText: M.itemCode }).waitFor({ state: 'attached', timeout: 120_000 });
  await itemSelect.selectOption({ label: `${M.itemName} (${M.itemCode})` });
  await so.locator('tbody tr').first().locator('input[type="number"]').fill('1000');
  await so.screenshot({ path: `${SHOTS}/01-request-form.png`, fullPage: true });
  await so.getByRole('button', { name: /submit request/i }).click();
  await expect.poll(() => check().requests.length, { timeout: 240_000, intervals: [10_000] }).toBe(1);
  let c = check();
  const REQ: string = c.requests[0].requestNr;
  console.log(`REQUEST ${REQ} ${c.requests[0].stage}`);
  expect(c.requests[0]).toMatchObject({ stage: 'STORES_MANAGER_APPROVAL', qty: [1000] });
  // evidence only (not part of this flow): which fields of the requester the request list sends to the browser
  const requesterKeys = await so.evaluate(async () => {
    const r = await fetch('/api/inventory/requests?status=PENDING', { cache: 'no-store' }).then((x) => x.json());
    const first = (Array.isArray(r) ? r : r.data ?? [])[0];
    return first?.requestedBy ? Object.keys(first.requestedBy) : [];
  });
  console.log('REQUESTER FIELDS IN THE LIST ' + JSON.stringify(requesterKeys));

  // 2. the OSP Manager cannot sign before the Stores Manager
  const osp = await signIn(browser, 'zzg6_osp');
  const early = await approvalsRow(osp, REQ, 30_000);
  if (early) {
    await early.getByRole('button').last().click();
    await osp.getByRole('button', { name: /approve & forward/i }).click();
    await osp.waitForTimeout(8000);
  }
  expect(check().requests[0].stage, 'the OSP Manager must not sign the Stores Manager step').toBe('STORES_MANAGER_APPROVAL');
  console.log(`OSP MANAGER FIRST: ${early ? 'listed but refused' : 'not in the queue'}`);

  // 3. Stores Manager -> OSP Manager -> Head of Section, each told by the bell
  const sm = await signIn(browser, 'zzg6_sm');
  await bell(sm, /New material request to review \(Stores Manager\)/, '02-bell-stores-manager');
  await approveRequest(sm, REQ, '03-approve-stores-manager');
  await expect.poll(() => check().requests[0].stage, { timeout: 240_000, intervals: [10_000] }).toBe('OSP_MANAGER_APPROVAL');

  await bell(osp, /Material request to approve \(OSP Manager\)/, '04-bell-osp-manager');
  await approveRequest(osp, REQ, '05-approve-osp-manager');
  await expect.poll(() => check().requests[0].stage, { timeout: 240_000, intervals: [10_000] }).toBe('HOS_APPROVAL');

  const hos = await signIn(browser, 'zzg6_hos');
  await bell(hos, /Material request to approve \(Head of Section\)/, '06-bell-head-of-section');
  await approveRequest(hos, REQ, '07-approve-head-of-section');
  await expect.poll(() => check().requests[0].stage, { timeout: 240_000, intervals: [10_000] }).toBe('PROCUREMENT');

  // 4. the Procurement Officer records the two HO orders: PO-A Vendor A 600 (30 days), PO-B Vendor B the open 400 (45 days)
  const proc = await signIn(browser, 'zzg6_proc');
  await bell(proc, /Material request approved: create the PO/, '08-bell-procurement');
  await proc.goto('/procurement/orders', { waitUntil: 'domcontentloaded' });
  const pendingRow = proc.locator('tr', { hasText: REQ }).first();
  await pendingRow.waitFor({ timeout: 240_000 });
  await pendingRow.getByRole('button', { name: /create po/i }).click();
  await poLine(proc, M.vendorA, '600', '150');
  await paymentTerms(proc, '30');
  await proc.screenshot({ path: `${SHOTS}/09-po-a-form.png`, fullPage: true });
  await proc.getByRole('button', { name: /create purchase order/i }).click();
  await expect.poll(() => check().pos.length, { timeout: 240_000, intervals: [10_000] }).toBe(1);

  const inProgressRow = async () => {
    await proc.goto('/procurement/orders', { waitUntil: 'domcontentloaded' });
    await proc.getByRole('button', { name: /^in progress$/i }).click();
    const r = proc.locator('tr', { hasText: REQ }).first();
    await r.waitFor({ timeout: 240_000 });
    return r;
  };
  let row = await inProgressRow();
  await row.getByRole('button', { name: /add po/i }).click();
  await poLine(proc, M.vendorB, null, '160');
  const openQty = await proc.getByRole('dialog').locator('tr', { hasText: M.itemName }).first().locator('input[type="number"]').nth(0).inputValue();
  expect(openQty, 'the second PO starts with the open quantity').toBe('400');
  await paymentTerms(proc, '45');
  await proc.screenshot({ path: `${SHOTS}/10-po-b-form.png`, fullPage: true });
  await proc.getByRole('button', { name: /create purchase order/i }).click();
  await expect.poll(() => check().pos.length, { timeout: 240_000, intervals: [10_000] }).toBe(2);
  c = check();
  const poA = c.pos.find((p: any) => p.vendor === M.vendorA);
  const poB = c.pos.find((p: any) => p.vendor === M.vendorB);
  expect(poA).toMatchObject({ ordered: [600], status: 'APPROVED', creditDays: 30 });
  expect(poB).toMatchObject({ ordered: [400], status: 'APPROVED', creditDays: 45 });

  // everything is ordered: no third PO can be added
  row = await inProgressRow();
  await expect(row.getByRole('button', { name: /add po/i }), 'no PO beyond the approved 1000').toHaveCount(0);
  await proc.screenshot({ path: `${SHOTS}/11-orders-in-progress.png`, fullPage: true });

  // sent to the vendors, confirmed, finished: the request goes to the stores for the GRN
  for (const step of [/^sent$/i, /^confirm$/i, /^finish$/i]) {
    row = await inProgressRow();
    await row.getByRole('button', { name: step }).click();
    await proc.waitForTimeout(6000);
  }
  await expect.poll(() => check().requests[0].procurement, { timeout: 240_000, intervals: [10_000] }).toBe('COMPLETED');
  console.log('REQUEST AFTER PROCUREMENT ' + JSON.stringify(check().requests[0]));
  await bell(so, /Procurement Completed/, '12-bell-requester-procurement-done');
  await so.context().close();
  const POA: string = poA.poNumber;
  const INV = `${POA}-INV-1`;

  // 5. the Stores Manager receives PO-A: 550 accepted, 50 rejected, with the Oracle GRN number and the vendor's invoice
  await sm.goto('/inventory/grn', { waitUntil: 'domcontentloaded' });
  const reqRow = sm.locator('tr', { hasText: REQ }).first();
  await reqRow.waitFor({ timeout: 240_000 });
  await reqRow.getByRole('button', { name: /create grn/i }).click();
  await sm.getByTestId('grn-oracle').waitFor({ timeout: 120_000 });
  await sm.locator('select', { has: sm.locator('option', { hasText: POA }) }).selectOption(POA);
  await sm.waitForTimeout(2000);
  const line = sm.locator('tr', { hasText: 'C-Hook' }).last();
  await line.locator('input[type="number"]').first().fill('550');
  await line.getByTestId('grn-rejected').fill('50');
  await line.getByTestId('grn-reject-reason').fill('ZZTEST: 50 hooks bent');
  await sm.getByPlaceholder('E.g. INV-2024-001').fill(INV);
  await sm.getByTestId('grn-oracle').fill('ORA-GRN-ZZ-0002');
  await sm.getByTestId('grn-inv-date').fill(new Date().toISOString().slice(0, 10));
  await sm.getByTestId('grn-inv-goods').fill('82500');
  await sm.getByTestId('grn-inv-tax').fill('0');
  await sm.locator('input[type="file"]').first().setInputFiles(pdf);
  await sm.screenshot({ path: `${SHOTS}/13-grn-form.png`, fullPage: true });
  await sm.getByRole('button', { name: /confirm receipt/i }).click();
  await expect.poll(() => check().grns.length, { timeout: 300_000, intervals: [10_000] }).toBe(1);
  c = check();
  expect(c.grns[0]).toMatchObject({ oracle: 'ORA-GRN-ZZ-0002', invoiceNo: INV, accepted: [550], rejected: [50] });
  expect(c.stock, 'only the accepted quantity enters stock').toBe(550);
  expect(c.invoices[0]).toMatchObject({ invoiceNumber: INV, grnLinked: true, status: 'MATCHED', total: 82500 });
  await sm.context().close();

  const voucherRow = async (page: Page) => {
    await page.goto('/finance/ho-payments', { waitUntil: 'domcontentloaded' });
    const r = page.getByTestId('vp-voucher').filter({ hasText: M.vendorA }).first();
    await r.waitFor({ timeout: 240_000 });
    return r;
  };
  const chainRow = async (page: Page) => {
    await page.goto('/procurement/payment-approvals', { waitUntil: 'domcontentloaded' });
    const r = page.getByTestId('pv-chain-row').filter({ hasText: M.vendorA }).first();
    await r.waitFor({ timeout: 240_000 });
    return r;
  };

  // 6. the OSP Account Officer is told, raises the voucher from that invoice and submits it
  const ao = await signIn(browser, 'zzg6_ao');
  await bell(ao, /GRN received with a vendor invoice/, '14-bell-account-officer-grn');
  await ao.goto('/finance/ho-payments', { waitUntil: 'domcontentloaded' });
  const invRow = ao.locator('tr', { hasText: INV }).first();
  await invRow.waitFor({ timeout: 240_000 });
  await invRow.getByTestId('vp-select').click();
  await ao.getByTestId('vp-create').click();
  let vrow = await voucherRow(ao);
  await vrow.getByTestId('vp-submit').click();
  await expect.poll(() => check().pvs[0]?.status, { timeout: 240_000, intervals: [10_000] }).toBe('PENDING_APPROVAL');

  // 7. OSP Account Manager -> OSP Manager -> Head of Section, each told by the bell; the invoice is posted at the last
  const am = await signIn(browser, 'zzg6_am');
  await bell(am, /Vendor payment to accept/, '15-bell-account-manager');
  vrow = await voucherRow(am);
  await vrow.getByTestId('vp-approve').click();
  await expect.poll(() => check().pvs[0]?.stage, { timeout: 240_000, intervals: [10_000] }).toBe('OSP_MANAGER');
  await am.context().close();

  await bell(osp, /Vendor payment to approve \(OSP Manager\)/, '16-bell-osp-manager-voucher');
  await (await chainRow(osp)).getByTestId('pv-approve').click();
  await expect.poll(() => check().pvs[0]?.stage, { timeout: 240_000, intervals: [10_000] }).toBe('HEAD_OF_SECTION');
  expect(check().invoices[0].status, 'not posted before the last approval').toBe('MATCHED');
  await osp.context().close();

  await bell(hos, /Vendor payment to approve \(Head of Section\)/, '17-bell-head-of-section-voucher');
  await (await chainRow(hos)).getByTestId('pv-approve').click();
  await expect.poll(() => check().pvs[0]?.status, { timeout: 240_000, intervals: [10_000] }).toBe('APPROVED');
  c = check();
  expect(c.invoices[0].status, 'posted at the Head of Section approval').toBe('APPROVED');
  expect(c.pvs[0].docs).toBe('TO_SEND');
  await hos.context().close();

  // 8. the OSP Account is told to send the documents; the Procurement Officer is told they were sent and marks them received
  await bell(ao, /send the documents to Procurement/, '18-bell-account-officer-documents');
  ao.once('dialog', (d) => d.accept());
  await (await chainRow(ao)).getByTestId('pv-docs-sent').click();
  await expect.poll(() => check().pvs[0]?.docs, { timeout: 240_000, intervals: [10_000] }).toBe('SENT');
  await ao.context().close();
  await bell(proc, /Voucher documents sent to Procurement/, '19-bell-procurement-documents');
  const procRow = await chainRow(proc);
  proc.once('dialog', (d) => d.accept());
  await procRow.getByTestId('pv-docs-received').click();
  await expect.poll(() => check().pvs[0]?.status, { timeout: 240_000, intervals: [10_000] }).toBe('SUBMITTED_TO_HO');
  await proc.context().close();

  // 9. the Account Executive at HO is told and records the payments HO made: 50,000 now, the rest later
  const ae = await signIn(browser, 'zzg6_ae');
  await bell(ae, /sent to HO/i, '20-bell-account-executive');
  for (const [amount, ref] of [['50000', 'ZZTEST-HO-PAY-1'], ['32500', 'ZZTEST-HO-PAY-2']]) {
    vrow = await voucherRow(ae);
    await vrow.getByTestId('vp-pay-part').click();
    await ae.getByTestId('ho-part-amount').fill(amount);
    await ae.getByTestId('ho-ref').fill(ref);
    await ae.getByTestId('ho-part-go').click();
    await expect.poll(() => check().parts.length, { timeout: 240_000, intervals: [10_000] }).toBe(ref.endsWith('1') ? 1 : 2);
  }
  c = check();
  expect(c.pvs[0]).toMatchObject({ status: 'PAID', amount: 82500, hoPaid: 82500 });
  expect(c.invoices[0]).toMatchObject({ status: 'PAID', paid: 82500 });
  expect(c.parts.every((p: any) => p.posted)).toBe(true);
  const all = c.journals.map((j: any) => j.lines.join(' | ')).join('\n');
  console.log('JOURNALS\n' + all);
  expect(all).toMatch(/INV-1010 DR 82500 \| AP-2010 CR 82500/);
  expect(all).toMatch(/AP-VEND-2010 DR 50000 \| HO-2020 CR 50000/);
  expect(all).toMatch(/AP-VEND-2010 DR 32500 \| HO-2020 CR 32500/);
  await bell(ae, /fully paid|Part payment made by HO/i, '21-bell-account-executive-paid');
  await ae.goto('/finance/ho-payments', { waitUntil: 'domcontentloaded' });
  await ae.getByTestId('vp-voucher').first().waitFor({ timeout: 240_000 });
  await ae.screenshot({ path: `${SHOTS}/22-payments.png`, fullPage: true });
  console.log('NOTICES ' + JSON.stringify(check().notices));
});
