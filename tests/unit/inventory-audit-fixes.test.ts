import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { threeWayMatch, DEFAULT_MATCH_PRICE_TOLERANCE_AMOUNT } from '../../src/lib/procurement-rules';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const line = (o: Partial<{ orderedPrice: number; invoicePrice: number; invoiceQty: number }>) => ({
    poItemId: 'l1', orderedQty: 10_000, orderedPrice: o.orderedPrice ?? 1000, receivedQty: 10_000, invoicedBefore: 0,
    invoiceQty: o.invoiceQty ?? 10_000, invoicePrice: o.invoicePrice ?? 1000,
});

test('a 2% overbill on a large order is a price variance: the percent alone let Rs. 200,000 through (MetaFloor audit, 27 Nov 2026)', () => {
    // 10,000 units ordered at Rs. 1,000, billed at Rs. 1,020: 2% (inside the percent), Rs. 200,000 over
    assert.equal(threeWayMatch([line({ invoicePrice: 1020 })], 2).lines[0].result, 'PRICE_VARIANCE');
    // a small order with the same 2% stays a match: 10 units, Rs. 200 over
    assert.equal(threeWayMatch([line({ invoicePrice: 1020, invoiceQty: 10 })], 2).lines[0].result, 'MATCHED');
    // exactly at the cap matches; the cap is a setting (MATCH_PRICE_TOLERANCE_AMOUNT), Rs. 5,000 by default
    assert.equal(DEFAULT_MATCH_PRICE_TOLERANCE_AMOUNT, 5000);
    assert.equal(threeWayMatch([line({ invoicePrice: 1000.5 })], 2, 5000).lines[0].result, 'MATCHED');
    assert.equal(threeWayMatch([line({ invoicePrice: 1000.51 })], 2, 5000).lines[0].result, 'PRICE_VARIANCE');
    // an underbill is never over the rupee cap
    assert.equal(threeWayMatch([line({ invoicePrice: 990 })], 2).lines[0].result, 'MATCHED');
});

test('the match is run again when the invoice is approved, without counting the invoice against itself', () => {
    const svc = read('src/services/procurement/supplier-invoice.service.ts');
    const approve = svc.slice(svc.indexOf('static async approve('), svc.indexOf('static async reject('));
    assert.match(approve, /const recheck = threeWayMatch\(/);
    assert.match(approve, /invoicedBefore: Math\.max\(0, c\.invoicedBefore - \(ownQty\.get\(c\.poItemId\) \?\? 0\)\)/);
    assert.match(approve, /recheck\.status !== 'MATCHED' && !\(overrideReason/);
    assert.match(approve, /status: 'VARIANCE', matchStatus: recheck\.status/, 'a stale match becomes a variance so the screen asks for the reason');
    assert.match(approve, /matchStatus: recheck\.status, matchDetail:/, 'the approval keeps the result it was approved on');
});

test('a cycle count takes the system quantity when the count is entered, so a movement after the count was created is not applied twice', () => {
    const svc = read('src/services/inventory/cycle-count.service.ts');
    const submit = svc.slice(svc.indexOf('static async submitCountResults('), svc.indexOf('static async approveCycleCount('));
    assert.match(submit, /const live = await tx\.inventoryStock\.findUnique\(/);
    assert.match(submit, /const sysQty = live \? Number\(live\.quantity\) : 0;/);
    assert.match(submit, /systemQty: sysQty,/);
    assert.doesNotMatch(submit, /Number\(existingLine\.systemQty\)/);
});
