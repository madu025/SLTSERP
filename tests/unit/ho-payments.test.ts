import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { batchStatus, canTransitionFunding, validApprovedAmount, validFundedAmount, remainingAllocation } from '../../src/lib/ho-payment-rules';
import { RBAC_PERMISSIONS, RBAC_PERMISSION_CODES } from '../../src/config/rbac-permissions';

const read = (p: string) => fs.readFileSync(p, 'utf8');

test('pack status follows its vouchers', () => {
  assert.equal(batchStatus(['SUBMITTED_TO_HO', 'SUBMITTED_TO_HO']), 'SUBMITTED');
  assert.equal(batchStatus(['PAID', 'SUBMITTED_TO_HO']), 'PARTIALLY_PAID');
  assert.equal(batchStatus(['PAID', 'PAID']), 'PAID');
  assert.equal(batchStatus(['APPROVED', 'APPROVED']), 'RETURNED');
  assert.equal(batchStatus([]), 'SUBMITTED');
});

test('funding request lifecycle and amounts', () => {
  assert.equal(canTransitionFunding('DRAFT', 'SUBMITTED'), true);
  assert.equal(canTransitionFunding('SUBMITTED', 'APPROVED'), true);
  assert.equal(canTransitionFunding('SUBMITTED', 'FUNDED'), false, 'must be approved first');
  assert.equal(canTransitionFunding('FUNDED', 'CANCELLED'), false);
  assert.equal(canTransitionFunding('REJECTED', 'APPROVED'), false);
  assert.equal(validApprovedAmount('PAYMENTS', 1000, 600), true, 'Head Office may approve part');
  assert.equal(validApprovedAmount('PAYMENTS', 1000, 1200), false);
  assert.equal(validApprovedAmount('PAYMENTS', 1000, 0), false);
  assert.equal(validApprovedAmount('PETTY_CASH_REPLENISH', 1000, 600), false, 'replenishment is all or nothing');
  assert.equal(validApprovedAmount('PETTY_CASH_REPLENISH', 1000, 1000), true);
  assert.equal(validFundedAmount(500, 500), true);
  assert.equal(validFundedAmount(500, 501), false);
  assert.equal(remainingAllocation({ approved: 1000, funded: 0, confirmedPaid: 400 }), 600);
});

test('permissions: Head Office capabilities are in the catalog and guard the routes', () => {
  assert.ok(RBAC_PERMISSION_CODES.includes(RBAC_PERMISSIONS.FINANCE_HO_SUBMIT));
  assert.ok(RBAC_PERMISSION_CODES.includes(RBAC_PERMISSIONS.FINANCE_HO_CONFIRM));
  const guard = read('src/lib/ho-voucher-access.ts');
  assert.match(guard, /FINANCE_HO_SUBMIT/);
  assert.match(guard, /FINANCE_HO_CONFIRM/);
  assert.match(read('src/app/api/finance/payment-vouchers/[id]/status/route.ts'), /assertHoTransition/);
  assert.match(read('src/app/api/projects/payment-vouchers/route.ts'), /assertHoTransition/);
  assert.match(read('src/app/api/finance/ho/batches/route.ts'), /FINANCE_HO_SUBMIT/);
  assert.match(read('src/app/api/finance/ho/funding/route.ts'), /FINANCE_HO_CONFIRM/);
});

test('wiring: no bank in OSP, Head Office current account, separation of duties, pack, email template, migration', () => {
  const svc = read('src/services/finance/payment-voucher.service.ts');
  assert.match(svc, /SUBMITTED_TO_HO/);
  assert.match(svc, /HO_REFERENCE_AND_DATE_REQUIRED/);
  assert.match(svc, /SUBMITTER_CANNOT_CONFIRM_HEAD_OFFICE_PAYMENT/);
  assert.match(svc, /MAKER_CANNOT_APPROVE_OR_PAY_OWN_VOUCHER/);
  assert.doesNotMatch(svc, /BANK_ACCOUNT_REQUIRED/);
  const ledger = read('src/services/finance/ledger.service.ts');
  assert.match(ledger, /bankAccountCode \|\| ACCOUNTS\.HO_CURRENT/);
  assert.match(ledger, /logHoPettyCashFunding/);
  assert.match(read('src/services/finance/petty-cash.service.ts'), /PETTY_CASH_REPLENISH/);
  assert.match(read('src/services/finance/ho-batch.service.ts'), /HO_PAYMENT_BATCH_SUBMITTED/);
  assert.match(read('src/config/notification-templates.ts'), /HO_PAYMENT_BATCH_SUBMITTED/);
  assert.match(read('prisma/seed-notification-templates.ts'), /HO_PAYMENT_BATCH_SUBMITTED/);
  assert.match(read('src/config/sidebar-menu.ts'), /\/finance\/ho-payments/);
  assert.match(read('src/services/control/approval-ageing.service.ts'), /SUBMITTED_TO_HO/);
  const mig = read('prisma/migrations/20261129000000_head_office_payments/migration.sql');
  for (const s of ['HO-2020', 'HoPaymentBatch', 'HoFundingRequest', 'finance.ho.submit', 'finance.ho.confirm', 'hoReference']) assert.ok(mig.includes(s), s);
});
