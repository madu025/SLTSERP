import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { billingBatchStatus, collectionStatusAfter, projectNetWithHo, sendBlocker, senderCannotConfirm, validCollectionAmount } from '../../src/lib/ho-billing-rules';

const read = (p: string) => fs.readFileSync(p, 'utf8');
const base = { type: 'CLIENT', status: 'ISSUED', submissionStatus: 'SUBMITTED_TO_SLT', balanceAmount: 1000, hoCollectionStatus: 'NOT_SENT', hoBillingBatchId: null };

test('only an unpaid client invoice already submitted to SLT can be sent to Head Office', () => {
  assert.equal(sendBlocker(base), null);
  assert.match(sendBlocker({ ...base, type: 'CONTRACTOR' }) ?? '', /ONLY_CLIENT/);
  assert.match(sendBlocker({ ...base, submissionStatus: 'NOT_SUBMITTED' }) ?? '', /SUBMITTED_TO_SLT_FIRST/);
  assert.match(sendBlocker({ ...base, balanceAmount: 0 }) ?? '', /NO_BALANCE/);
  assert.match(sendBlocker({ ...base, hoCollectionStatus: 'SENT_TO_HO', hoBillingBatchId: 'b1' }) ?? '', /ALREADY_WITH_HEAD_OFFICE/);
  assert.match(sendBlocker({ ...base, hoCollectionStatus: 'PARTIALLY_COLLECTED', hoBillingBatchId: 'b1' }) ?? '', /ALREADY_WITH_HEAD_OFFICE/);
  assert.equal(sendBlocker({ ...base, hoCollectionStatus: 'RETURNED' }), null, 'a returned invoice can be sent again');
});

test('collection amount: positive, two decimals, never above the balance', () => {
  assert.equal(validCollectionAmount(1000, 1000), true);
  assert.equal(validCollectionAmount(1000, 400.5), true);
  assert.equal(validCollectionAmount(1000, 1000.01), false);
  assert.equal(validCollectionAmount(1000, 0), false);
  assert.equal(validCollectionAmount(1000, -5), false);
  assert.equal(validCollectionAmount(1000, 10.123), false);
  assert.equal(validCollectionAmount(1000, Number.NaN), false);
});

test('status after a collection and pack status', () => {
  assert.equal(collectionStatusAfter(1000, 400), 'PARTIALLY_COLLECTED');
  assert.equal(collectionStatusAfter(1000, 1000), 'COLLECTED');
  assert.equal(billingBatchStatus(['SENT_TO_HO', 'SENT_TO_HO']), 'SENT');
  assert.equal(billingBatchStatus(['COLLECTED', 'SENT_TO_HO']), 'PARTIALLY_COLLECTED');
  assert.equal(billingBatchStatus(['PARTIALLY_COLLECTED']), 'PARTIALLY_COLLECTED');
  assert.equal(billingBatchStatus(['COLLECTED', 'COLLECTED']), 'COLLECTED');
  assert.equal(billingBatchStatus(['RETURNED']), 'RETURNED');
  assert.equal(billingBatchStatus([]), 'SENT');
});

test('separation of duties and project net', () => {
  assert.equal(senderCannotConfirm('u1', 'u1'), true);
  assert.equal(senderCannotConfirm('u1', 'u2'), false);
  assert.equal(senderCannotConfirm(null, 'u2'), false);
  assert.equal(projectNetWithHo({ collected: 1000, voucherPaid: 300 }), 700);
  assert.equal(projectNetWithHo({ collected: 100, voucherPaid: 300 }), -200);
});

test('wiring: collection posts to the Head Office account, bank receipts are blocked, routes are guarded', () => {
  const svc = read('src/services/finance/ho-billing.service.ts');
  assert.match(svc, /accountCode: ACCOUNTS\.HO_CURRENT, debit: input\.amount/);
  assert.match(svc, /accountCode: ACCOUNTS\.AR_CLIENT, debit: 0, credit: input\.amount/);
  assert.match(svc, /FOR UPDATE/);
  assert.match(svc, /SENDER_CANNOT_CONFIRM_HEAD_OFFICE_COLLECTION/);
  assert.doesNotMatch(svc, /ACCOUNTS\.BANK\b/);
  assert.match(read('src/app/api/projects/invoice-receipts/route.ts'), /CLIENT_RECEIPTS_ARE_COLLECTED_BY_HEAD_OFFICE/);
  assert.match(read('src/app/api/finance/ar/receipts/route.ts'), /CLIENT_RECEIPTS_ARE_COLLECTED_BY_HEAD_OFFICE/);
  const route = read('src/app/api/finance/ho/billing/route.ts');
  assert.match(route, /FINANCE_HO_SUBMIT/);
  assert.match(route, /FINANCE_HO_CONFIRM/);
});

test('migration, email template and menu are wired', () => {
  const mig = read('prisma/migrations/20261130000000_head_office_collections/migration.sql');
  assert.match(mig, /"hoCollectionStatus"/);
  assert.match(mig, /CREATE TABLE IF NOT EXISTS "HoBillingBatch"/);
  assert.match(read('src/config/notification-templates.ts'), /HO_BILLING_PACK_SUBMITTED/);
  assert.match(read('prisma/seed-notification-templates.ts'), /HO_BILLING_PACK_SUBMITTED/);
  assert.match(read('src/services/finance/ho-billing.service.ts'), /renderEmailByCode\('HO_BILLING_PACK_SUBMITTED'/);
  const menu = read('src/config/sidebar-menu.ts');
  assert.match(menu, /\/finance\/ho-billing/);
  assert.match(menu, /\/finance\/ho-projects/);
});
