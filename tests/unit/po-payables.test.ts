import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { daysOverdue, dueBucket, dueDateOf, validateCreditTerms } from '../../src/lib/po-payables';
import { RBAC_PERMISSIONS, RBAC_PERMISSION_DEFINITIONS } from '../../src/config/rbac-permissions';
import { MODULE_DESIGNATION_GRANTS, getCanonicalBootstrapRoles } from '../../src/config/rbac-bootstrap';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('the Procurement Officer gives the payment terms; on credit, credit days or a due date', () => {
    assert.match(validateCreditTerms(null)!, /how the order is paid/);
    assert.match(validateCreditTerms({ basis: 'CREDIT' })!, /credit days or the due date/);
    assert.equal(validateCreditTerms({ basis: 'CREDIT', creditDays: 60 }), null);
    assert.equal(validateCreditTerms({ basis: 'CREDIT', dueDate: '2027-01-31' }), null);
    assert.match(validateCreditTerms({ basis: 'CREDIT', creditDays: 0 })!, /1 to 365/);
    assert.equal(validateCreditTerms({ basis: 'ON_DELIVERY' }), null);
});

test('due dates and aging by days past due', () => {
    const received = new Date('2026-11-26T00:00:00Z');
    assert.equal(dueDateOf({ basis: 'CREDIT', creditDays: 60, firstReceiptAt: received })!.toISOString().slice(0, 10), '2027-01-25');
    assert.equal(dueDateOf({ basis: 'CREDIT', creditDays: 60, paymentDueDate: '2027-02-15', firstReceiptAt: received })!.toISOString().slice(0, 10), '2027-02-15');
    assert.equal(daysOverdue(new Date('2026-11-20'), new Date('2026-11-26')), 6);
    assert.equal(dueBucket(-5), 'current');
    assert.equal(dueBucket(45), 'days31to60');
    assert.equal(dueBucket(120), 'over90');
});

test('a GRN of an HO order needs the Oracle GRN number and the vendor invoice, and creates that invoice in the same transaction (source check)', () => {
    const grn = read('src/services/inventory/grn.service.ts');
    assert.match(grn, /ORACLE_GRN_NUMBER_REQUIRED/);
    assert.match(grn, /VENDOR_INVOICE_REQUIRED: attach the scanned vendor invoice/);
    assert.match(grn, /GRN_REJECT_REASON_REQUIRED/, 'a rejected quantity needs its reason');
    assert.match(grn, /HO_ORDER_ONE_PO_PER_GRN/, 'an HO order is received one PO per GRN');
    assert.match(grn, /SupplierInvoiceService\.createFromGrnTx\(tx as unknown as Prisma\.TransactionClient/, 'the invoice is saved with the GRN or not at all');
    assert.match(grn, /rejectedQty: Number\(item\.rejectedQty \?\? 0\)/);
    const si = read('src/services/procurement/supplier-invoice.service.ts');
    assert.match(si, /static async createFromGrnTx\(/);
    assert.match(si, /grnId: input\.grnId/);
    const schema = read('prisma/schema/supplier-invoice.prisma');
    assert.match(schema, /grnId\s+String\?\s+@unique @db\.Uuid/, 'one vendor invoice per GRN');
});

test('the OSP Account Manager accepts the voucher and, with it, the GRN invoice; the Account Executive records part payments (source check)', () => {
    const pv = read('src/services/finance/payment-voucher.service.ts');
    assert.match(pv, /const grnInvoiceAwaitingVoucher = !!si\.grnId && \['MATCHED', 'VARIANCE'\]\.includes\(si\.status\)/, 'a voucher can be raised from a GRN invoice before it is approved');
    assert.match(pv, /await SupplierInvoiceService\.approve\(si\.id, userId, options\?\.matchOverrideReason \?\? null\)/, 'accepting the voucher approves its invoice first');
    const ho = read('src/services/procurement/ho-payment.service.ts');
    assert.match(ho, /pv\.createdById === input\.userId \|\| pv\.approvedById === input\.userId/, 'the maker and the approver cannot record the payment');
    assert.match(ho, /accountCode: ACCOUNTS\.AP_VENDOR, debit: amount/);
    assert.match(ho, /accountCode: ACCOUNTS\.HO_CURRENT, debit: 0, credit: amount/);
    assert.match(ho, /idempotencyKey: `PV_INSTALLMENT_\$\{inst\.id\}`/, 'a payment is never posted twice');
    assert.match(ho, /status: 'PAID', paidById/, 'the voucher is PAID when the parts reach its amount');
    assert.match(ho, /HO pays it in one payment of the full amount/, 'a voucher with deductions is paid in one go');
});

test('only the Account Executive designation records HO payments, and the three positions exist as designations', () => {
    const codes = new Set<string>(RBAC_PERMISSION_DEFINITIONS.map((p) => p.code));
    assert.ok(codes.has(RBAC_PERMISSIONS.PROCUREMENT_HO_PAYMENT_RECORD));
    assert.ok(!codes.has('procurement.ho.payment.verify'), 'there is no separate verification step');
    assert.deepEqual([...getCanonicalBootstrapRoles(RBAC_PERMISSIONS.PROCUREMENT_HO_PAYMENT_RECORD)], [], 'no whole base role records HO payments');
    assert.deepEqual(MODULE_DESIGNATION_GRANTS[RBAC_PERMISSIONS.PROCUREMENT_HO_PAYMENT_RECORD], ['HO_ACCOUNT_EXECUTIVE_FINANCE_ASSISTANT']);
    const sql = read('prisma/migrations/20261225000000_company_p2p_flow/migration.sql');
    for (const c of ['OSP_ACCOUNT_OFFICER_FINANCE_ASSISTANT', 'OSP_ACCOUNT_MANAGER_FINANCE_MANAGER', 'HO_ACCOUNT_EXECUTIVE_FINANCE_ASSISTANT']) assert.match(sql, new RegExp(`'${c}'`));
    assert.match(sql, /'STORES_MANAGER', 'DEFAULT', 'inventory\.approve', '\["STORES_MANAGER"\]'/, 'the Stores Manager reviews the material request before the OSP Manager');
    assert.match(sql, /AND NOT EXISTS/, 'the chain change can run twice without adding the step twice');
});

test('the screens of the superseded flows are gone (one place for each step)', () => {
    assert.ok(!existsSync(new URL('../../src/app/inventory/grn/po-receipt/page.tsx', import.meta.url)), 'no multi-PO GRN screen');
    assert.ok(!existsSync(new URL('../../src/app/api/procurement/purchase-orders/[id]/payments/route.ts', import.meta.url)), 'no payments on the PO');
    assert.ok(existsSync(new URL('../../src/app/api/finance/payment-vouchers/[id]/payments/route.ts', import.meta.url)), 'payments are on the voucher');
    assert.match(read('src/app/finance/ho-payments/page.tsx'), /data-testid="vp-pay-part"/);
    assert.match(read('src/app/inventory/grn/page.tsx'), /data-testid="grn-oracle"/);
});

test('the voucher payments route checks the voucher scope like the status route (security review)', () => {
    const route = read('src/app/api/finance/payment-vouchers/[id]/payments/route.ts');
    assert.match(route, /await assertVoucherAccess\(voucher\.projectId, userId, voucher\.description\)/);
    assert.equal((route.match(/await voucherInScope\(id, userId\)/g) ?? []).length, 2, 'both reading and recording are scoped');
});

test('a request with an HO order cannot be received as a combined intake without choosing the PO (found while writing the browser pass)', () => {
    assert.match(read('src/services/inventory/grn.service.ts'), /HO_ORDER_PO_REQUIRED: choose the purchase order this delivery is for/);
});
