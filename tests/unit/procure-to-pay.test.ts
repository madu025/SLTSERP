import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  invoicePosting, parsePaymentTerms, dueDateFrom, debitNoteQty, requiredTier, withinLimit, canTransitionProjectPo,
  unifiedPoStatus, canTransitionPo, isPoEditable, poStatusFromReceipts,
} from '../../src/lib/procurement-rules';

const read = (p: string) => fs.readFileSync(p, 'utf8');

test('invoice posting: price variance goes to PPV, tax to input VAT, entry balances', () => {
  const up = invoicePosting([{ quantity: 10, orderPrice: 100, invoicePrice: 110, taxAmount: 198 }]);
  assert.deepEqual(up, { clearing: 1000, priceVariance: 100, tax: 198, total: 1298 });
  const down = invoicePosting([{ quantity: 10, orderPrice: 100, invoicePrice: 90, taxAmount: 0 }]);
  assert.equal(down.priceVariance, -100);
  const same = invoicePosting([{ quantity: 5, orderPrice: 20, invoicePrice: 20, taxAmount: 18 }]);
  assert.equal(same.priceVariance, 0);
  for (const r of [up, down, same]) assert.equal(Math.round((r.clearing + r.priceVariance + r.tax - r.total) * 100), 0);
});

test('payment terms parsed into due dates', () => {
  assert.equal(parsePaymentTerms('Net 30'), 30);
  assert.equal(parsePaymentTerms('45 days'), 45);
  assert.equal(parsePaymentTerms('Immediate'), 0);
  assert.equal(parsePaymentTerms('whenever'), null);
  assert.equal(parsePaymentTerms(null), null);
  const d = dueDateFrom('2026-01-01T00:00:00Z', null, 'Net 30');
  assert.equal(d?.toISOString().slice(0, 10), '2026-01-31');
  assert.equal(dueDateFrom('2026-01-01', 'x', undefined), null);
});

test('debit note only for the invoiced part of a return', () => {
  assert.equal(debitNoteQty(10, 10, 0, 4), 4);
  assert.equal(debitNoteQty(6, 10, 0, 4), 0, 'still 6 left to match 6 billed');
  assert.equal(debitNoteQty(8, 10, 0, 4), 2);
  assert.equal(debitNoteQty(8, 10, 4, 2), 2);
});

test('approval tiers and limits', () => {
  const t = { manager: 100, gm: 500, director: 1000 };
  assert.equal(requiredTier(100, t), 'Manager');
  assert.equal(requiredTier(101, t), 'General Manager');
  assert.equal(requiredTier(1000, t), 'Director');
  assert.equal(requiredTier(1001, t), null);
  assert.equal(withinLimit(5000, null), true);
  assert.equal(withinLimit(101, 100), false);
});

test('PO lifecycle: pending approval, project transitions, unified status', () => {
  assert.equal(canTransitionPo('PENDING_APPROVAL', 'APPROVED'), true);
  assert.equal(canTransitionPo('PENDING_APPROVAL', 'ISSUED'), false);
  assert.equal(isPoEditable('PENDING_APPROVAL', false), true);
  assert.equal(poStatusFromReceipts('PENDING_APPROVAL', [{ quantity: 10, receivedQty: 0 }]), 'PENDING_APPROVAL');
  assert.equal(canTransitionProjectPo('DRAFT', 'ISSUED'), false);
  assert.equal(canTransitionProjectPo('DRAFT', 'APPROVED'), true);
  assert.equal(canTransitionProjectPo('CLOSED', 'ISSUED'), false);
  assert.equal(unifiedPoStatus('PROJECT', 'FULLY_RECEIVED'), 'RECEIVED');
  assert.equal(unifiedPoStatus('STORE', 'COMPLETED'), 'RECEIVED');
});

test('wiring: posting accounts, vendor payment, debit note, unified list', () => {
  const inv = read('src/services/procurement/supplier-invoice.service.ts');
  assert.match(inv, /ACCOUNTS\.PPV/);
  assert.match(inv, /ACCOUNTS\.INPUT_VAT/);
  assert.doesNotMatch(inv, /markPaid/);
  assert.match(read('src/services/finance/ledger.service.ts'), /bankAccountCode/);
  assert.match(read('src/services/inventory/mrn.service.ts'), /SupplierDebitNoteService/);
  assert.match(read('src/services/finance/payment-voucher.service.ts'), /supplierInvoiceId/);
  assert.match(read('src/config/sidebar-menu.ts'), /\/finance\/vendor-payments/);
  assert.match(read('src/app/api/procurement/purchase-orders/all/route.ts'), /UnifiedPoService/);
  const mig = read('prisma/migrations/20261128000000_standard_procure_to_pay/migration.sql');
  for (const s of ['VAT-REC-1310', 'EXP-PPV-5050', 'SupplierDebitNote', 'paidAmount', 'approvedById']) assert.ok(mig.includes(s), s);
});
