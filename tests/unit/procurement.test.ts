import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  canTransitionPo, normalizePoStatus, isPoEditable, poStatusFromReceipts, validatePoLine, computePoTotals, overReceiptCheck,
  weightedAverageCost, priceVariancePct, threeWayMatch, type MatchLine,
} from '../../src/lib/procurement-rules';
import { suggestedOrderQty } from '../../src/lib/supply-chain-shared';

const read = (p: string) => fs.readFileSync(p, 'utf8');

test('PO lifecycle: only forward moves, cancelled and closed are final, legacy statuses are read sensibly', () => {
  assert.equal(canTransitionPo('APPROVED', 'ISSUED'), true);
  assert.equal(canTransitionPo('APPROVED', 'CANCELLED'), true);
  assert.equal(canTransitionPo('PARTIALLY_RECEIVED', 'CANCELLED'), false, 'goods received: cannot cancel');
  assert.equal(canTransitionPo('RECEIVED', 'CLOSED'), true);
  assert.equal(canTransitionPo('CLOSED', 'ISSUED'), false);
  assert.equal(canTransitionPo('CANCELLED', 'APPROVED'), false);
  assert.equal(normalizePoStatus('COMPLETED'), 'RECEIVED');
  assert.equal(normalizePoStatus('PENDING'), 'APPROVED');
  assert.equal(normalizePoStatus(null), 'APPROVED');
});

test('PO is editable only before anything is received', () => {
  assert.equal(isPoEditable('APPROVED', false), true);
  assert.equal(isPoEditable('ISSUED', false), true);
  assert.equal(isPoEditable('ISSUED', true), false);
  assert.equal(isPoEditable('RECEIVED', false), false);
  assert.equal(isPoEditable('CANCELLED', false), false);
});

test('PO status follows receipts', () => {
  assert.equal(poStatusFromReceipts('APPROVED', [{ quantity: 10, receivedQty: 0 }]), 'APPROVED');
  assert.equal(poStatusFromReceipts('ISSUED', [{ quantity: 10, receivedQty: 0 }]), 'ISSUED');
  assert.equal(poStatusFromReceipts('APPROVED', [{ quantity: 10, receivedQty: 4 }, { quantity: 5, receivedQty: 5 }]), 'PARTIALLY_RECEIVED');
  assert.equal(poStatusFromReceipts('APPROVED', [{ quantity: 10, receivedQty: 10 }, { quantity: 5, receivedQty: 5 }]), 'RECEIVED');
  assert.equal(poStatusFromReceipts('CANCELLED', [{ quantity: 1, receivedQty: 1 }]), 'CANCELLED');
});

test('PO lines are validated and totals are computed, never trusted', () => {
  assert.equal(validatePoLine({ quantity: 0, unitPrice: 5 }), 'Quantity must be greater than zero');
  assert.match(validatePoLine({ quantity: 1, unitPrice: -1 }) ?? '', /negative/);
  assert.equal(validatePoLine({ quantity: 2, unitPrice: 0 }), null, 'a zero price is allowed (price agreed later)');
  const t = computePoTotals([{ quantity: 3, unitPrice: 10.5, taxAmount: 2 }, { quantity: 1, unitPrice: 100 }]);
  assert.equal(t.subtotal, 131.5);
  assert.equal(t.taxAmount, 2);
  assert.equal(t.totalAmount, 133.5);
  assert.deepEqual(t.lineTotals, [33.5, 100]);
});

test('over-receipt: balance and tolerance', () => {
  assert.equal(overReceiptCheck(10, 0, 10).ok, true);
  assert.equal(overReceiptCheck(10, 6, 5).ok, false);
  assert.equal(overReceiptCheck(10, 6, 4).ok, true);
  assert.equal(overReceiptCheck(10, 10, 1, 10).ok, true, '10% tolerance allows one more');
  assert.equal(overReceiptCheck(10, 10, 2, 10).ok, false);
  assert.equal(overReceiptCheck(10, 0, 0).ok, false, 'receiving nothing is not a receipt');
  assert.equal(Number(overReceiptCheck(10, 6, 1).remaining.toFixed(2)), 4);
});

test('weighted average cost', () => {
  assert.equal(weightedAverageCost(0, 0, 10, 50), 50, 'nothing on hand: the receipt cost');
  assert.equal(weightedAverageCost(10, 100, 10, 200), 150);
  assert.equal(weightedAverageCost(30, 100, 10, 200), 125);
  assert.equal(weightedAverageCost(10, 100, 0, 999), 100, 'no receipt: unchanged');
  assert.equal(weightedAverageCost(10, 0, 10, 50), 25, 'stock carried at zero cost drags the average down');
});

test('price variance', () => {
  assert.equal(priceVariancePct(110, 100), 10);
  assert.equal(priceVariancePct(90, 100), -10);
  assert.equal(priceVariancePct(5, 0), null);
  assert.equal(priceVariancePct(5, null), null);
});

const line = (over: Partial<MatchLine> = {}): MatchLine => ({ poItemId: 'a', orderedQty: 10, orderedPrice: 100, receivedQty: 10, invoicedBefore: 0, invoiceQty: 10, invoicePrice: 100, ...over });

test('3-way match: clean invoice matches', () => {
  const m = threeWayMatch([line()]);
  assert.equal(m.status, 'MATCHED');
  assert.equal(m.lines[0].result, 'MATCHED');
});

test('3-way match: price within tolerance matches, above it does not', () => {
  assert.equal(threeWayMatch([line({ invoicePrice: 101.5 })], 2).status, 'MATCHED');
  const bad = threeWayMatch([line({ invoicePrice: 105 })], 2);
  assert.equal(bad.status, 'VARIANCE');
  assert.equal(bad.lines[0].result, 'PRICE_VARIANCE');
  assert.equal(bad.lines[0].priceVariancePct, 5);
  assert.equal(threeWayMatch([line({ invoicePrice: 95 })], 2).lines[0].result, 'PRICE_VARIANCE', 'cheaper than the order is also reported');
});

test('3-way match: cannot bill more than received and not yet billed', () => {
  assert.equal(threeWayMatch([line({ receivedQty: 6, invoiceQty: 10 })]).lines[0].result, 'QTY_OVER_RECEIVED');
  assert.equal(threeWayMatch([line({ receivedQty: 10, invoicedBefore: 6, invoiceQty: 5 })]).lines[0].result, 'QTY_OVER_RECEIVED');
  assert.equal(threeWayMatch([line({ receivedQty: 10, invoicedBefore: 6, invoiceQty: 4 })]).status, 'MATCHED');
  assert.equal(threeWayMatch([line({ receivedQty: 0 })]).lines[0].result, 'NOT_RECEIVED');
});

test('3-way match: one bad line makes the invoice a variance', () => {
  const m = threeWayMatch([line(), line({ poItemId: 'b', invoicePrice: 150 })]);
  assert.equal(m.status, 'VARIANCE');
  assert.equal(m.issues, 1);
});

test('suggested order quantity brings stock back to twice the minimum', () => {
  assert.equal(suggestedOrderQty(3, 10), 17);
  assert.equal(suggestedOrderQty(25, 10), 0);
  assert.equal(suggestedOrderQty(-4, 5), 14);
});

test('procurement wiring: routes, receipts, costing, migrations', () => {
  const grn = read('src/services/inventory/grn.service.ts');
  assert.match(grn, /GRN_QUANTITY_EXCEEDS_PO/, 'GRN blocks over-receipt against the PO');
  assert.match(grn, /weightedAverageCost/);
  assert.match(grn, /unitPrice: costPrice/, 'ledger carries cost, not the selling price');
  assert.match(grn, /receivedQty: \{ increment: qty \}/, 'PO line received quantity moves in the same transaction');

  const po = read('src/services/procurement/purchase-order.service.ts');
  assert.match(po, /getNextDocumentNumber\('SPO'/, 'PO numbers come from the server');
  assert.match(po, /computePoTotals/);
  assert.match(read('src/services/inventory/stock-request.service.ts'), /PurchaseOrderService\.createStorePo/, 'legacy CREATE_PO action uses the validated service');

  const gr = read('src/services/project/project-goods-receipt.service.ts');
  assert.match(gr, /GR_QUANTITY_EXCEEDS_PO/);
  assert.match(gr, /ITEM_NOT_ON_PURCHASE_ORDER/);
  assert.match(gr, /status === 'REJECTED'/, 'a rejected receipt gives its quantity back');

  const inv = read('src/services/procurement/supplier-invoice.service.ts');
  assert.match(inv, /SEGREGATION_OF_DUTIES_VIOLATION/);
  assert.match(inv, /MATCH_OVERRIDE_REASON_REQUIRED/);

  const m1 = read('prisma/migrations/20261126000000_procurement_control/migration.sql');
  for (const needle of ['"vendorId" UUID', 'receivedQty', 'CREATE TABLE IF NOT EXISTS "SupplierInvoice"']) assert.ok(m1.includes(needle), needle);
  assert.doesNotMatch(m1, /DROP |TRUNCATE |DELETE FROM/i, 'additive migration');
  const m2 = read('prisma/migrations/20261126000100_costing_functions/migration.sql');
  assert.match(m2, /fn_store_inventory_value/);
  assert.match(m2, /fn_update_rop_levels/);
  assert.doesNotMatch(m2.split('fn_update_rop_levels')[1], /UPDATE public\."InventoryStock"[\s\S]*SET "minLevel" = i\."minLevel"/, 'ROP no longer copies the item level onto every store');
  assert.match(read('src/services/service-order/sod.material.service.ts'), /pickedUnitCost/, 'SOD ledger uses the weighted cost of the whole pick');
});
