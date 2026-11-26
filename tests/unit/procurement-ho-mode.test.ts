import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

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
