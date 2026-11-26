import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hoClearingDelta, poApprovalMode, validateHoEvidence } from '../../src/lib/po-approval-chain';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const good = { ref: 'HO/PO/2026/0412', date: '2026-11-20', approvedBy: 'A. Perera, GM Finance', documentUrl: '/api/storage/procurement/po-0412.pdf' };

test('HO mode is the default; only an explicit NEXUS_CHAIN turns the Nexus chain on', () => {
    assert.equal(poApprovalMode(undefined), 'HO_DOCUMENTS');
    assert.equal(poApprovalMode(''), 'HO_DOCUMENTS');
    assert.equal(poApprovalMode('nexus_chain'), 'HO_DOCUMENTS', 'unknown text is read as the default');
    assert.equal(poApprovalMode('NEXUS_CHAIN'), 'NEXUS_CHAIN');
    assert.match(read('src/services/core/system-config.service.ts'), /PROCUREMENT_PO_APPROVAL_MODE: map\.PROCUREMENT_PO_APPROVAL_MODE \|\| 'HO_DOCUMENTS'/);
    assert.match(read('src/app/admin/settings/page.tsx'), /PROCUREMENT_PO_APPROVAL_MODE/, 'the admin can switch it');
});

test('an HO-approved order needs its reference, date, approver and scanned document', () => {
    const now = new Date('2026-11-26T10:00:00Z');
    assert.equal(validateHoEvidence(good, now), null);
    assert.match(validateHoEvidence(null, now)!, /required/);
    assert.match(validateHoEvidence({ ...good, ref: 'x' }, now)!, /reference/);
    assert.match(validateHoEvidence({ ...good, date: 'not a date' }, now)!, /date/);
    assert.match(validateHoEvidence({ ...good, date: '2026-12-31' }, now)!, /future/);
    assert.match(validateHoEvidence({ ...good, approvedBy: '' }, now)!, /approved/);
    assert.match(validateHoEvidence({ ...good, documentUrl: '' }, now)!, /document/);
    assert.match(validateHoEvidence({ ...good, documentUrl: 'javascript:alert(1)' }, now)!, /document/, 'only a stored file link is accepted');
    assert.equal(validateHoEvidence({ ...good, documentUrl: 'https://files.example/po.pdf' }, now), null);
});

test('recording the HO payment clears only the received value not yet cleared', () => {
    assert.equal(hoClearingDelta(1_000_000, 0), 1_000_000);
    assert.equal(hoClearingDelta(1_500_000, 1_000_000), 500_000, 'a later receipt clears the difference');
    assert.equal(hoClearingDelta(1_000_000, 1_000_000), 0);
    assert.equal(hoClearingDelta(900_000, 1_000_000), 0, 'never negative');
});

test('the service records an HO-approved order as approved, with the evidence and a log entry (source check)', () => {
    const svc = read('src/services/procurement/purchase-order.service.ts');
    assert.match(svc, /if \(mode === 'HO_DOCUMENTS'\) \{\s*\n\s*const err = validateHoEvidence\(ho\);/, 'the evidence is required in HO mode');
    assert.match(svc, /status: recordedFromHo \? 'APPROVED' : 'PENDING_APPROVAL'/);
    assert.match(svc, /hoDocumentUrl: ho!\.documentUrl!\.trim\(\)/);
    assert.match(svc, /action: 'RECORDED'/, 'the approval log records where the approval came from');
    assert.match(svc, /if \(valueChanged && po\.hoApprovalRef\)/, 'the vendor or value of an HO-approved order cannot be changed in Nexus');
});

test('the HO payment clears goods received against the HO current account, once, and not when Nexus invoiced the order (source check)', () => {
    const svc = read('src/services/procurement/purchase-order.service.ts');
    assert.match(svc, /accountCode: ACCOUNTS\.AP_ACCRUED, debit: delta/);
    assert.match(svc, /accountCode: ACCOUNTS\.HO_CURRENT, debit: 0, credit: delta/);
    assert.match(svc, /idempotencyKey: `HO_PAYMENT_\$\{po\.id\}_\$\{cleared\.toFixed\(2\)\}`/, 'the same clearing is never posted twice');
    assert.match(svc, /status: \{ in: \['AWAITING_EXECUTIVE', 'APPROVED', 'PARTIALLY_PAID', 'PAID'\] \}/);
    const inv = read('src/services/procurement/supplier-invoice.service.ts');
    assert.match(inv, /HO_ALREADY_PAID/, 'an order paid by HO cannot also be invoiced and approved in Nexus');
    const route = read('src/app/api/procurement/purchase-orders/route.ts');
    assert.match(route, /action: z\.literal\('RECORD_HO_PAYMENT'\)/);
    assert.match(route, /\[RBAC_PERMISSIONS\.PROCUREMENT_WRITE, RBAC_PERMISSIONS\.FINANCE_WRITE, RBAC_PERMISSIONS\.ADMIN_RBAC\]\.some/, 'procurement or finance records it');
});

test('one GRN can receive the goods of several purchase orders of one vendor (source check)', () => {
    const grn = read('src/services/inventory/grn.service.ts');
    assert.match(grn, /const lineMode = items\.some\(\(i\) => i\.poItemId\)/);
    assert.match(grn, /GRN_MIXED_VENDORS/, 'one delivery is from one vendor');
    assert.match(grn, /GRN_PO_MODE_CONFLICT/);
    assert.match(grn, /overReceiptCheck\(Number\(l\.quantity\), Number\(l\.receivedQty\), qty, cfg\.overReceiptTolerancePct\)/, 'over-receipt is checked per PO line');
    assert.match(grn, /PURCHASE_ORDER_NOT_APPROVED/);
    assert.match(grn, /tx\.gRNItem\.create\(\{\s*\n\s*data: \{ grnId: grn\.id, itemId: item\.itemId, quantity: qty, poItemId: poLine\?\.id \?\? null, unitPrice: costPrice, batchId: batch\.id \}/, 'each line keeps its own PO line and batch, even for the same item on two orders');
    assert.match(grn, /for \(const id of poIdsTouched\)/, 'every order moves to partly or fully received on its own');
    assert.match(grn, /for \(const requestId of requestIdsTouched\)/, 'every stock request behind those orders is updated');
    assert.match(read('src/lib/validations/inventory.schema.ts'), /poItemId: databaseUuidSchema\.nullish\(\)/);
    assert.match(read('src/app/api/inventory/grn/open-po-lines/route.ts'), /permissions: \[RBAC_PERMISSIONS\.INVENTORY_GRN\]/, 'the stores people who receive goods can list the open lines');
});

test('the migration is additive', () => {
    const sql = read('prisma/migrations/20261223000000_po_ho_mode/migration.sql');
    for (const c of ['hoApprovalRef', 'hoApprovalDate', 'hoApprovedBy', 'hoDocumentUrl', 'hoInvoiceRef', 'hoPaymentRef', 'hoPaidAt', 'hoClearedAmount']) assert.match(sql, new RegExp(`ADD COLUMN "${c}"`));
    assert.doesNotMatch(sql, /DROP|DELETE|UPDATE /);
});

test('a GRN can only receive PO lines of orders raised by the receiving store (security review)', () => {
    const grn = read('src/services/inventory/grn.service.ts');
    assert.match(grn, /await StoreService\.assertStoreWriteAccess\(receivedById, storeId\)/, 'the receiver must have write access to the store');
    assert.match(grn, /if \(l\.purchaseOrder\.stockRequest\.fromStoreId !== storeId\) throw AppError\.forbidden\(`PURCHASE_ORDER_LINE_NOT_IN_STORE/, 'another store\'s order cannot be received here');
});

test('the GRN journal entry names the GRN number, and the PO list opens the order history page (browser pass)', () => {
    assert.match(read('src/services/inventory/grn.service.ts'), /logGrnReceipt\(tx, grn\.id, totalGrnCost, `GRN \$\{grnNumber\}: goods received in store/);
    assert.match(read('src/services/procurement/unified-po.service.ts'), /href: `\/procurement\/orders\/\$\{p\.id\}`/, 'a received order (gone from the Order Processing tabs) is still reachable');
    assert.match(read('src/app/procurement/orders/[id]/page.tsx'), /data-testid="ho-payment-form"/, 'the HO payment can be recorded on the history page');
});
