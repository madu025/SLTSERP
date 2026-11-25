import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { materialIssueSchema } from '../../src/lib/validations/inventory.schema';

/**
 * Found by the end to end run on ZZTEST data: issuing 0, a negative number or text to a contractor was accepted and created an issue note
 * (using up a MIN number, shown to the contractor as pending) although no stock moved.
 */
const base = { contractorId: 'c1', storeId: 's1', month: '2026-11' };
const parse = (quantity: unknown) => materialIssueSchema.safeParse({ ...base, items: [{ itemId: 'i1', quantity }] });

test('the issue API accepts a positive quantity, as number or as text', () => {
    assert.ok(parse(5).success);
    assert.ok(parse('12.5').success);
});

test('the issue API refuses zero, negative, text and empty quantities', () => {
    for (const bad of [0, -1, '0', '-3', 'abc', '', NaN, Infinity]) assert.ok(!parse(bad).success, `refused: ${String(bad)}`);
});

test('the issue service checks every line before it creates a note, so the server action is covered too', () => {
    const s = fs.readFileSync('src/services/inventory/issue.service.ts', 'utf8');
    const start = s.indexOf('static async issueMaterial');
    const body = s.slice(start, start + 2500);
    assert.ok(body.indexOf('assertPositiveLines') > 0 && body.indexOf('assertPositiveLines') < body.indexOf('generateMINNumber'), 'the quantity check comes before the MIN number is taken');
});

import { assertPositiveLines, assertPositiveQuantity } from '../../src/lib/quantity-guard';

test('the shared guard: a positive number passes, everything else is refused with INVALID_QUANTITY', () => {
    assert.equal(assertPositiveQuantity('12.5', 'x'), 12.5);
    assert.equal(assertPositiveQuantity(3, 'x'), 3);
    for (const bad of [0, -1, '0', '-3', 'abc', '', null, undefined, NaN, Infinity]) assert.throws(() => assertPositiveQuantity(bad, 'x'), /INVALID_QUANTITY/, String(bad));
    assert.throws(() => assertPositiveLines([], 'quantity', () => 'x'), /At least one item/);
    assert.throws(() => assertPositiveLines([{ quantity: 4 }, { quantity: 0 }], 'quantity', () => 'line 2'), /INVALID_QUANTITY/);
    assert.doesNotThrow(() => assertPositiveLines([{ quantity: 4 }, { quantity: '0.5' }], 'quantity', () => 'x'));
});

test('every document a person types quantities into checks them before it takes a number: issue, store return, contractor return, material request', () => {
    const read = (f: string) => fs.readFileSync(f, 'utf8');
    const issue = read('src/services/inventory/issue.service.ts');
    assert.ok(/assertPositiveLines\(items, 'quantity'[^\n]*issued item/.test(issue), 'issue note');
    assert.ok(/assertPositiveLines\(items, 'quantity'[^\n]*returned item/.test(issue), 'store return');
    assert.ok(read('src/services/inventory/contractor-inventory.service.ts').includes("assertPositiveQuantity(data.quantity, 'the returned item')"), 'contractor return');
    assert.ok(read('src/services/inventory/stock-request.service.ts').includes("assertPositiveLines(items, 'requestedQty'"), 'material request');
});

test('a sub store request must come from someone who works at that store or in its area', () => {
    const s = fs.readFileSync('src/services/inventory/stock-request.service.ts', 'utf8');
    assert.ok(/fromStore\.type === 'SUB'\) await StoreService\.assertStoreWriteAccess\(requestedById, fromStoreId\)/.test(s), 'the request service checks the store of the person');
});

test('the contractor stock is locked while it is picked, and the dashboard values stock at cost (migration 20261221000000)', () => {
    const sql = fs.readFileSync('prisma/migrations/20261221000000_inventory_concurrency_and_value/migration.sql', 'utf8');
    assert.ok(/fn_fifo_pick_contractor_batches[\s\S]*FOR UPDATE OF cbs/.test(sql), 'row lock on the contractor batch stock, like the store side');
    const dash = sql.slice(sql.indexOf('fn_store_dashboard_summary('));
    assert.ok(dash.includes('i."costPrice"') && !dash.includes('i."unitPrice"') && !dash.includes('avg_price'), 'value at cost, not at the selling price or the purchase order average');
});

test('the stock requests page does not crash on a request without a store (6 of 86 in production have none)', () => {
    const s = fs.readFileSync('src/app/inventory/requests/page.tsx', 'utf8');
    assert.ok(!/r\.fromStore\.name/.test(s) && !/r\.requestedBy\.name/.test(s) && !/item\.item\.name/.test(s), 'every name on the requests list is read null-safely');
});

test('an issue or return line takes the unit of the item, not "Nos" (drop wire in metres was shown as Nos)', () => {
    const s = fs.readFileSync('src/services/inventory/issue.service.ts', 'utf8');
    assert.ok(s.includes("unit: i.unit || itemUnits.get(i.itemId) || 'Nos'"), 'issue note lines');
    assert.ok(s.includes("unit: item.unit || itemUnits.get(item.itemId) || 'Nos'"), 'return note lines');
});
