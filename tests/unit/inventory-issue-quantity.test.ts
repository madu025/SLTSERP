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
