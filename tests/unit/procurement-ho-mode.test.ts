import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { poApprovalMode } from '../../src/lib/po-approval-chain';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('HO mode is the default; only an explicit NEXUS_CHAIN turns the Nexus chain on', () => {
    assert.equal(poApprovalMode(undefined), 'HO_DOCUMENTS');
    assert.equal(poApprovalMode(''), 'HO_DOCUMENTS');
    assert.equal(poApprovalMode('nexus_chain'), 'HO_DOCUMENTS', 'unknown text is read as the default');
    assert.equal(poApprovalMode('NEXUS_CHAIN'), 'NEXUS_CHAIN');
    assert.match(read('src/services/core/system-config.service.ts'), /PROCUREMENT_PO_APPROVAL_MODE: map\.PROCUREMENT_PO_APPROVAL_MODE \|\| 'HO_DOCUMENTS'/);
    assert.match(read('src/app/admin/settings/page.tsx'), /PROCUREMENT_PO_APPROVAL_MODE/, 'the admin can switch it');
});

test('the service records an HO-approved order as approved with its payment terms and a log entry; no HO approval fields (source check)', () => {
    const svc = read('src/services/procurement/purchase-order.service.ts');
    assert.match(svc, /if \(mode === 'HO_DOCUMENTS'\) \{\s*\n\s*const termsErr = validateCreditTerms\(input\.credit\);/, 'the payment terms are required in HO mode');
    assert.match(svc, /const recordedFromHo = mode === 'HO_DOCUMENTS';/);
    assert.match(svc, /status: recordedFromHo \? 'APPROVED' : 'PENDING_APPROVAL'/);
    assert.doesNotMatch(svc, /validateHoEvidence|hoDocumentUrl: ho/, 'no HO approval reference, approver or scan is asked (owner, 26 Nov 2026)');
    assert.match(svc, /action: 'RECORDED'/, 'the approval log records where the approval came from');
    assert.match(svc, /if \(valueChanged && \(po\.hoApprovalRef \|\| \(await this\.approvalMode\(\)\) === 'HO_DOCUMENTS'\)\)/, 'the vendor or value of an HO-approved order cannot be changed in Nexus');
    assert.doesNotMatch(read('src/app/procurement/orders/page.tsx'), /data-testid="ho-ref"|Approved by \(name and designation\)/);
});

test('a GRN line names its PO line; a line-based GRN never mixes vendors or HO orders (source check)', () => {
    const grn = read('src/services/inventory/grn.service.ts');
    assert.match(grn, /const lineMode = items\.some\(\(i\) => i\.poItemId\)/);
    assert.match(grn, /GRN_MIXED_VENDORS/, 'one delivery is from one vendor');
    assert.match(grn, /GRN_PO_MODE_CONFLICT/);
    assert.match(grn, /overReceiptCheck\(Number\(l\.quantity\), Number\(l\.receivedQty\), qty, cfg\.overReceiptTolerancePct\)/, 'over-receipt is checked per PO line');
    assert.match(grn, /PURCHASE_ORDER_NOT_APPROVED/);
    assert.match(grn, /tx\.gRNItem\.create\(\{\s*\n\s*data: \{ grnId: grn\.id, itemId: item\.itemId, quantity: qty, poItemId: poLine\?\.id \?\? null, unitPrice: costPrice, batchId: batch\.id, rejectedQty:/, 'each line keeps its own PO line and batch, even for the same item on two orders');
    assert.match(grn, /for \(const id of poIdsTouched\)/, 'every order moves to partly or fully received on its own');
    assert.match(grn, /for \(const requestId of requestIdsTouched\)/, 'every stock request behind those orders is updated');
    assert.match(read('src/lib/validations/inventory.schema.ts'), /poItemId: databaseUuidSchema\.nullish\(\)/);
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
});
