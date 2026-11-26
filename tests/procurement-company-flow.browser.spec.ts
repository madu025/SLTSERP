import { test, expect, type Browser, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * The company procure-to-pay flow by the real roles (data from scripts/zz-gui6.ts setup; run against the deployed site because the GRN uploads a scan):
 *   Stores Manager: GRN for PO-A, 600 ordered, 600 delivered, 550 accepted and 50 rejected with a reason, Oracle GRN number, vendor invoice;
 *   OSP Account Officer: payment voucher from that GRN's invoice; OSP Account Manager, OSP Manager, Head of Section approve it (the invoice is posted
 *   at the last); the OSP Account confirms the documents were sent; the Procurement Officer marks them received (the voucher goes to HO);
 *   the Account Executive at HO records 50,000 then the rest; ledger, invoice and voucher end PAID; each step's people got their notice.
 * Env: GUI6_PASSWORD, GUI6_REQ, GUI6_POA, GUI6_VENDOR_A.
 */
const PASSWORD = process.env.GUI6_PASSWORD ?? '';
const REQ = process.env.GUI6_REQ ?? '';
const POA = process.env.GUI6_POA ?? '';
const VENDOR_A = process.env.GUI6_VENDOR_A ?? '';
const INV = `${POA}-INV-1`;

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
  const out = execFileSync('pnpm', ['exec', 'tsx', 'scripts/zz-gui6.ts', 'check'], { shell: true, encoding: 'utf8' });
  const line = out.split('\n').find((l) => l.startsWith('CHECK '))!;
  console.log(line);
  return JSON.parse(line.slice(6));
};

async function voucherRow(page: Page) {
  await page.goto('/finance/ho-payments', { waitUntil: 'domcontentloaded' });
  const row = page.getByTestId('vp-voucher').filter({ hasText: VENDOR_A }).first();
  await row.waitFor({ timeout: 240_000 });
  return row;
}

test('company flow: GRN with rejection and vendor invoice, voucher, acceptance, HO part payments', async ({ browser }) => {
  test.setTimeout(2_400_000);
  expect(REQ && POA && VENDOR_A, 'GUI6_* must be set').toBeTruthy();
  const pdf = path.join(os.tmpdir(), 'zztest-vendor-invoice.pdf');
  fs.writeFileSync(pdf, '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');

  // 1. the Stores Manager receives PO-A: 550 accepted, 50 rejected, with the Oracle GRN number and the vendor's invoice
  const sm = await signIn(browser, 'zzg6_sm');
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
  await sm.getByTestId('grn-oracle').fill('ORA-GRN-ZZ-0001');
  await sm.getByTestId('grn-inv-date').fill(new Date().toISOString().slice(0, 10));
  await sm.getByTestId('grn-inv-goods').fill('82500');
  await sm.getByTestId('grn-inv-tax').fill('0');
  await sm.locator('input[type="file"]').first().setInputFiles(pdf);
  await sm.getByRole('button', { name: /confirm receipt/i }).click();
  await expect.poll(() => check().grns.length, { timeout: 300_000, intervals: [10_000] }).toBe(1);
  let c = check();
  expect(c.grns[0]).toMatchObject({ oracle: 'ORA-GRN-ZZ-0001', invoiceNo: INV, accepted: [550], rejected: [50] });
  expect(c.stock, 'only the accepted quantity enters stock').toBe(550);
  expect(c.invoices[0]).toMatchObject({ invoiceNumber: INV, grnLinked: true, status: 'MATCHED', total: 82500 });
  expect(c.invoices[0].due, 'due 30 days after the GRN').toBeTruthy();
  await sm.screenshot({ path: 'test-results/cf-1-grn.png', fullPage: true });
  await sm.context().close();

  // 2. the OSP Account Officer raises the voucher from that invoice and submits it
  const ao = await signIn(browser, 'zzg6_ao');
  await ao.goto('/finance/ho-payments', { waitUntil: 'domcontentloaded' });
  const invRow = ao.locator('tr', { hasText: INV }).first();
  await invRow.waitFor({ timeout: 240_000 });
  await invRow.getByTestId('vp-select').click();
  await ao.getByTestId('vp-create').click();
  let row = await voucherRow(ao);
  await row.getByTestId('vp-submit').click();
  await expect.poll(() => check().pvs[0]?.status, { timeout: 240_000, intervals: [10_000] }).toBe('PENDING_APPROVAL');

  // 3. the OSP Account Manager accepts it (step 1 of 3)
  const am = await signIn(browser, 'zzg6_am');
  row = await voucherRow(am);
  await row.getByTestId('vp-approve').click();
  await expect.poll(() => check().pvs[0]?.stage, { timeout: 240_000, intervals: [10_000] }).toBe('OSP_MANAGER');
  await am.context().close();

  // 4. the OSP Manager, then the Head of Section, on Vendor Payment Approvals; the invoice is posted at the Head of Section's approval
  const chainRow = async (page: Page) => {
    await page.goto('/procurement/payment-approvals', { waitUntil: 'domcontentloaded' });
    const r = page.getByTestId('pv-chain-row').filter({ hasText: VENDOR_A }).first();
    await r.waitFor({ timeout: 240_000 });
    return r;
  };
  const osp = await signIn(browser, 'zzg6_osp');
  await (await chainRow(osp)).getByTestId('pv-approve').click();
  await expect.poll(() => check().pvs[0]?.stage, { timeout: 240_000, intervals: [10_000] }).toBe('HEAD_OF_SECTION');
  expect(check().invoices[0].status, 'not posted before the last approval').toBe('MATCHED');
  await osp.context().close();
  const hos = await signIn(browser, 'zzg6_hos');
  await (await chainRow(hos)).getByTestId('pv-approve').click();
  await expect.poll(() => check().pvs[0]?.status, { timeout: 240_000, intervals: [10_000] }).toBe('APPROVED');
  c = check();
  expect(c.invoices[0].status, 'posted at the Head of Section approval').toBe('APPROVED');
  expect(c.pvs[0].docs).toBe('TO_SEND');
  await hos.context().close();

  // 4b. the OSP Account sends the documents to Procurement; the Procurement Officer checks them and sends the voucher to HO
  await ao.goto('/procurement/payment-approvals', { waitUntil: 'domcontentloaded' });
  ao.once('dialog', (d) => d.accept());
  await (await chainRow(ao)).getByTestId('pv-docs-sent').click();
  await expect.poll(() => check().pvs[0]?.docs, { timeout: 240_000, intervals: [10_000] }).toBe('SENT');
  await ao.context().close();
  const proc = await signIn(browser, 'zzg6_proc');
  const procRow = await chainRow(proc);
  proc.once('dialog', (d) => d.accept());
  await procRow.getByTestId('pv-docs-received').click();
  await expect.poll(() => check().pvs[0]?.status, { timeout: 240_000, intervals: [10_000] }).toBe('SUBMITTED_TO_HO');
  await proc.screenshot({ path: 'test-results/cf-2-vendor-payment-approvals.png', fullPage: true });
  await proc.context().close();

  // 5. the Account Executive at HO records the payments HO made: 50,000 now, the rest later
  const ae = await signIn(browser, 'zzg6_ae');
  for (const [amount, ref] of [['50000', 'ZZTEST-HO-PAY-1'], ['32500', 'ZZTEST-HO-PAY-2']]) {
    row = await voucherRow(ae);
    await row.getByTestId('vp-pay-part').click();
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
  await ae.goto('/finance/ho-payments', { waitUntil: 'domcontentloaded' });
  await ae.getByTestId('vp-voucher').first().waitFor({ timeout: 240_000 });
  await ae.screenshot({ path: 'test-results/cf-3-payments.png', fullPage: true });

  // 6. every step told the people of the next one
  const n = check().notices;
  console.log('NOTICES ' + JSON.stringify(n));
  const has = (key: string, re: RegExp) => expect((n[key] ?? []).some((t: string) => re.test(t)), `${key} got a notice like ${re}`).toBe(true);
  has('ao', /GRN received with a vendor invoice/);
  has('am', /Vendor payment to accept/);
  has('osp', /Vendor payment to approve \(OSP Manager\)/);
  has('hos', /Vendor payment to approve \(Head of Section\)/);
  has('ao', /send the documents to Procurement/);
  has('proc', /Voucher documents sent to Procurement/);
  has('ae', /sent to HO|Part payment made by HO|fully paid/);
});
