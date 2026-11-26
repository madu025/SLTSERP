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
    assert.match(read('src/services/finance/pv-chain.service.ts'), /await SupplierInvoiceService\.approve\(si\.id, userId, matchOverrideReason \?\? null, \{ viaVoucherChain: true \}\)/, 'accepting the voucher approves its invoice first');
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

test('vendor voucher chain: Account Manager, OSP Manager, Head of Section, invoice posted at the last step, documents before HO (source check)', () => {
    const chain = read('src/services/finance/pv-chain.service.ts');
    assert.match(chain, /export const PV_STAGES = \['ACCOUNT_MANAGER', 'OSP_MANAGER', 'HEAD_OF_SECTION'\] as const;/);
    assert.match(chain, /pv\.createdById === userId \|\| trail\.some\(\(t\) => t\.action === 'APPROVED' && t\.userId === userId\)/, 'nobody signs two steps, the maker none');
    assert.match(chain, /data: \{ status: 'DRAFT', approvalStage: null/, 'a rejection goes back to the Account Officer');
    assert.match(chain, /docsStatus: 'NOT_RECEIVED'/);
    assert.match(chain, /status: 'SUBMITTED_TO_HO', submittedToHoById: userId, submittedToHoAt: new Date\(\), docsStatus: 'RECEIVED'/, 'documents received: the voucher goes to HO');
    const pv = read('src/services/finance/payment-voucher.service.ts');
    assert.match(pv, /return PvChainService\.accountManagerStep\(id, userId\);/, 'the Account Manager approval is step 1, not the end');
    assert.match(pv, /VENDOR_VOUCHER_DOCUMENTS_STEP/, 'a company-flow voucher cannot be sent to HO without the documents step');
    assert.match(read('src/services/finance/ho-batch.service.ts'), /docsStatus: null/, 'never in an HO pack');
    const boot = read('src/config/rbac-bootstrap.ts');
    assert.match(boot, /FINANCE_PV_APPROVE_OSP\]: \['OSP_MANAGER'\]/);
    assert.match(boot, /FINANCE_PV_APPROVE_HOS\]: \['HEAD_OF_SECTION'\]/);
    assert.match(boot, /PROCUREMENT_PV_DOCUMENTS\]: \['PROCUREMENT_OFFICER'\]/);
});

test('the OSP Account confirms the documents were sent before Procurement checks them, and every step notifies the next (source check)', () => {
    const chain = read('src/services/finance/pv-chain.service.ts');
    assert.match(chain, /docsStatus: 'TO_SEND'/, 'after the last approval the OSP Account must send the documents');
    assert.match(chain, /docsStatus: \{ in: \['TO_SEND', 'NOT_RECEIVED'\] \} \}, data: \{ docsStatus: 'SENT'/, 'Documents sent (also again after not received)');
    assert.match(chain, /pv\.docsStatus !== 'SENT'\) throw AppError\.badRequest\('The OSP Account has not sent the documents/, 'Procurement checks only what was sent');
    for (const a of ["notifyStep('PROCESS_GATE_OSP_MANAGER'", "notifyStep('PROCESS_GATE_HEAD_OF_SECTION'", "notifyStep('PROCESS_GATE_PROCUREMENT'", "'Vendor payment approved by the OSP Manager'", "'Vendor payment approved: send the documents to Procurement'", "'Voucher documents not received by Procurement'", "'Vendor payment sent to HO'", "'Vendor payment rejected'"]) {
        assert.ok(chain.includes(a), `notice: ${a}`);
    }
    assert.match(read('src/services/finance/payment-voucher.service.ts'), /notifyStep\('PV_ACCOUNT_MANAGERS', existing, 'Vendor payment to accept \(OSP Account Manager\)'/);
    assert.match(read('src/services/procurement/ho-payment.service.ts'), /'Vendor payment fully paid by HO' : 'Part payment made by HO'/);
    assert.match(read('src/services/inventory/grn.service.ts'), /title: 'GRN received with a vendor invoice: raise the payment voucher'/);
});

test('material request chain: Stores Manager, OSP Manager, Head of Section, then Procurement; stage names say who it waits for (found by the browser pass)', () => {
    const sql = read('prisma/migrations/20261227000000_material_request_chain_fix/migration.sql');
    assert.match(sql, /SET "toStatus" = 'STORES_MANAGER_APPROVAL'/, 'a new request starts with the Stores Manager');
    assert.match(sql, /'STORES_MANAGER_APPROVAL', 'OSP_MANAGER_APPROVAL', '2\. Stores Manager Review'/);
    assert.match(sql, /"requiredRole" = 'OSP_MANAGER', "eligibleRoles" = '\["OSP_MANAGER"\]'[\s\S]*"fromStatus" = 'OSP_MANAGER_APPROVAL' AND p\."toStatus" = 'HOS_APPROVAL'/, 'at Awaiting OSP Manager the OSP Manager signs');
    assert.match(sql, /"requiredRole" = 'HEAD_OF_SECTION', "eligibleRoles" = '\["HEAD_OF_SECTION"\]'[\s\S]*"fromStatus" = 'HOS_APPROVAL' AND p\."toStatus" = 'PROCUREMENT'/, 'at Awaiting Head of Section the Head of Section signs');
    assert.match(sql, /WHERE NOT EXISTS/, 'the new gate is added once');
    const seed = read('src/services/admin/process-gate.service.ts');
    assert.match(seed, /fromStatus: 'STORES_MANAGER_APPROVAL',\s*\n\s*toStatus: 'OSP_MANAGER_APPROVAL'/, 'a fresh database gets the same chain');
    assert.match(read('src/services/inventory/stock-request.service.ts'), /isExternalProcurement \? 'STORES_MANAGER_APPROVAL' : 'ARM_APPROVAL'/);
});

test('step 1 is the OSP Account Manager\'s own capability, and the chain\'s people reach company-flow vouchers (found by the browser pass)', () => {
    const chain = read('src/services/finance/pv-chain.service.ts');
    assert.ok(chain.includes('ACCOUNT_MANAGER: RBAC_PERMISSIONS.FINANCE_PV_APPROVE_ACCOUNT'), 'the Stores Manager also holds finance.approve, so step 1 has its own capability');
    assert.ok(chain.includes('if (await userHasPermission(userId, RBAC_PERMISSIONS.PROCUREMENT_PV_CHAIN_READ)) return;'), 'the Head of Section and Procurement reach the voucher without company-wide finance scope');
    const boot = read('src/config/rbac-bootstrap.ts');
    assert.ok(boot.includes("[RBAC_PERMISSIONS.FINANCE_PV_APPROVE_ACCOUNT]: ['FINANCE_MANAGER']"));
    assert.ok(boot.includes("[RBAC_PERMISSIONS.NOTIFICATION_PV_ACCOUNT_MANAGERS]: ['FINANCE_MANAGER']"), 'the step 1 notice goes to the Finance Manager only, not the Stores Manager');
});
