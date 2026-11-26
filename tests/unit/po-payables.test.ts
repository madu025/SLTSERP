import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { advanceToApply, daysOverdue, dueBucket, dueDateOf, outstanding, owedForReceived, payableTotal, recordingCapError, splitPayment, validateCreditTerms, type PayableState } from '../../src/lib/po-payables';
import { RBAC_PERMISSIONS, RBAC_PERMISSION_DEFINITIONS } from '../../src/config/rbac-permissions';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
// an order of 300,000 goods + 54,000 tax, of which 200,000 of goods has been received
const base: PayableState = { orderedGoods: 300_000, tax: 54_000, receivedValue: 200_000, cleared: 0, advance: 0, taxPaid: 0 };

test('the Procurement Officer must give the payment terms; on credit, credit days or a due date', () => {
    assert.match(validateCreditTerms(null)!, /how the order is paid/);
    assert.match(validateCreditTerms({ basis: 'CREDIT' })!, /credit days or the due date/);
    assert.equal(validateCreditTerms({ basis: 'CREDIT', creditDays: 60 }), null);
    assert.equal(validateCreditTerms({ basis: 'CREDIT', dueDate: '2027-01-31' }), null);
    assert.match(validateCreditTerms({ basis: 'CREDIT', creditDays: 0 })!, /1 to 365/);
    assert.match(validateCreditTerms({ basis: 'CREDIT', creditDays: 12.5 })!, /whole number/);
    assert.equal(validateCreditTerms({ basis: 'ON_DELIVERY' }), null);
    assert.match(validateCreditTerms({ basis: 'LATER' })!, /Unknown/);
});

test('the due date: typed date first, else goods received + credit days; advance at order; on delivery at receipt', () => {
    const received = new Date('2026-11-26T00:00:00Z');
    assert.equal(dueDateOf({ basis: 'CREDIT', creditDays: 60, firstReceiptAt: received })!.toISOString().slice(0, 10), '2027-01-25');
    assert.equal(dueDateOf({ basis: 'CREDIT', creditDays: 60, paymentDueDate: '2027-02-15', firstReceiptAt: received })!.toISOString().slice(0, 10), '2027-02-15');
    assert.equal(dueDateOf({ basis: 'CREDIT', creditDays: 60, firstReceiptAt: null }), null, 'not known before the goods arrive');
    assert.equal(dueDateOf({ basis: 'ADVANCE', orderDate: '2026-11-20' })!.toISOString().slice(0, 10), '2026-11-20');
    assert.equal(dueDateOf({ basis: 'ON_DELIVERY', firstReceiptAt: received })!.toISOString().slice(0, 10), '2026-11-26');
    assert.equal(daysOverdue(new Date('2026-11-20'), new Date('2026-11-26')), 6);
    assert.equal(daysOverdue(new Date('2026-12-01'), new Date('2026-11-26')), -5);
    assert.equal(dueBucket(-5), 'current');
    assert.equal(dueBucket(45), 'days31to60');
    assert.equal(dueBucket(120), 'over90');
});

test('a payment pays received goods first, then goods not yet received (advance), then tax; never more than the order is worth', () => {
    assert.equal(payableTotal(base), 354_000);
    assert.deepEqual(splitPayment(150_000, base), { toGrir: 150_000, toAdvance: 0, toTax: 0 }, 'part payment of received goods');
    assert.deepEqual(splitPayment(250_000, base), { toGrir: 200_000, toAdvance: 50_000, toTax: 0 }, 'more than received: the rest is an advance');
    assert.deepEqual(splitPayment(354_000, base), { toGrir: 200_000, toAdvance: 100_000, toTax: 54_000 }, 'the whole order');
    assert.match(splitPayment(354_000.5, base).error!, /more than is still owed/);
    const afterFirst: PayableState = { ...base, cleared: 150_000 };
    assert.deepEqual(splitPayment(50_000, afterFirst), { toGrir: 50_000, toAdvance: 0, toTax: 0 }, 'the second part pays the rest of the received goods');
    assert.equal(owedForReceived(afterFirst), 50_000);
    assert.equal(outstanding(afterFirst), 204_000);
    assert.match(splitPayment(0, base).error!, /greater than zero/);
});

test('goods arriving after an advance use the advance; recording more than the order is worth is refused', () => {
    assert.equal(advanceToApply(100_000, 60_000), 60_000);
    assert.equal(advanceToApply(100_000, 160_000), 100_000);
    assert.equal(advanceToApply(0, 60_000), 0);
    assert.equal(recordingCapError(100_000, 200_000, 354_000), null);
    assert.match(recordingCapError(200_000, 200_000, 354_000)!, /more than the order is worth/, 'recorded but unverified payments count too');
});

test('recording and verifying are two capabilities held by different roles, and one person can never do both on a payment (source check)', () => {
    const codes = new Set<string>(RBAC_PERMISSION_DEFINITIONS.map((p) => p.code));
    assert.ok(codes.has(RBAC_PERMISSIONS.PROCUREMENT_HO_PAYMENT_RECORD) && codes.has(RBAC_PERMISSIONS.PROCUREMENT_HO_PAYMENT_VERIFY));
    const boot = read('src/config/rbac-bootstrap.ts');
    assert.match(boot, /PROCUREMENT_HO_PAYMENT_VERIFY\]: \['FINANCE_MANAGER'\]/);
    const svc = read('src/services/procurement/ho-payment.service.ts');
    assert.match(svc, /inst\.recordedById === userId/, 'the recorder cannot verify');
    assert.match(svc, /SELECT id FROM "PurchaseOrder" WHERE id = \$\{po\.id\}::uuid FOR UPDATE/, 'two verifications cannot use the same balance');
    assert.match(svc, /accountCode: ACCOUNTS\.AP_ACCRUED, debit: split\.toGrir/);
    assert.match(svc, /accountCode: ACCOUNTS\.ADVANCES, debit: split\.toAdvance/);
    assert.match(svc, /accountCode: ACCOUNTS\.INPUT_VAT, debit: split\.toTax/);
    assert.match(svc, /accountCode: ACCOUNTS\.HO_CURRENT, debit: 0, credit: amount/);
    assert.match(svc, /idempotencyKey: `HO_INSTALLMENT_\$\{inst\.id\}`/, 'a payment is never posted twice');
    assert.match(svc, /status: \{ in: \['AWAITING_EXECUTIVE', 'APPROVED', 'PARTIALLY_PAID', 'PAID'\] \}/, 'not on an order invoiced in Nexus');
    const route = read('src/app/api/procurement/purchase-orders/[id]/payments/route.ts');
    assert.match(route, /case 'RECORD':\s*\n\s*if \(!can\(RBAC_PERMISSIONS\.PROCUREMENT_HO_PAYMENT_RECORD\)\)/);
    assert.match(route, /case 'VERIFY':\s*\n\s*if \(!can\(RBAC_PERMISSIONS\.PROCUREMENT_HO_PAYMENT_VERIFY\)\)/);
});

test('a GRN moves an advance to GR/IR, and the reports and reminders see HO-mode orders (source check)', () => {
    const grn = read('src/services/inventory/grn.service.ts');
    assert.match(grn, /const apply = advanceToApply\(Number\(p\.hoAdvanceAmount\), receiptValue\)/);
    assert.match(grn, /idempotencyKey: `HO_ADVANCE_APPLY_\$\{grn\.id\}_\$\{id\}`/);
    assert.match(read('src/services/finance/vendor-statement.service.ts'), /type: 'GOODS_RECEIVED' as const/);
    const aging = read('src/services/finance/ar-ap.service.ts');
    assert.match(aging, /HoPayablesService\.orders\(\{\}, today\)/);
    assert.match(aging, /new Date\(inv\.dueDate \?\? inv\.invoiceDate\)/, 'supplier invoices age from the due date');
    assert.match(read('src/services/service-order/sod.sync.service.ts'), /\{ name: 'po-payment-reminders', type: 'PO_PAYMENT_REMINDERS', at: '07:40'/);
    assert.match(read('src/workers/system.worker.ts'), /PO_PAYMENT_REMINDERS: async \(\) =>/);
    const po = read('src/services/procurement/purchase-order.service.ts');
    assert.match(po, /const termsErr = validateCreditTerms\(input\.credit\);/, 'HO-mode orders need their payment terms');
    assert.doesNotMatch(po, /static async recordHoPayment/, 'the single payment record was replaced by the payments table');
});

test('the migration is additive and refuses a zero or negative amount', () => {
    const sql = read('prisma/migrations/20261224000000_po_credit_ho_payments/migration.sql');
    assert.match(sql, /CREATE TABLE "HoPaymentInstallment"/);
    assert.match(sql, /CHECK \("amount" > 0\)/);
    for (const c of ['paymentBasis', 'creditDays', 'paymentDueDate', 'hoAdvanceAmount', 'hoTaxPaid']) assert.match(sql, new RegExp(`ADD COLUMN "${c}"`));
    assert.doesNotMatch(sql, /DROP |DELETE FROM|UPDATE "/);
});
