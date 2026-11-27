import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { threeWayMatch, isAbovePoPrice } from '../../src/lib/procurement-rules';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const line = (o: Partial<{ orderedPrice: number; invoicePrice: number; invoiceQty: number }>) => ({
    poItemId: 'l1', orderedQty: 10_000, orderedPrice: o.orderedPrice ?? 1000, receivedQty: 10_000, invoicedBefore: 0,
    invoiceQty: o.invoiceQty ?? 10_000, invoicePrice: o.invoicePrice ?? 1000,
});

test('no invoice above the PO price: the PO is what HO approved (owner, 27 Nov 2026); the 2% tolerance let Rs. 200,000 through on a large order', () => {
    assert.equal(threeWayMatch([line({ invoicePrice: 1020 })]).lines[0].result, 'ABOVE_PO_PRICE');
    assert.equal(threeWayMatch([line({ invoicePrice: 1000.01, invoiceQty: 1 })]).lines[0].result, 'ABOVE_PO_PRICE', 'even one cent on one unit');
    assert.equal(isAbovePoPrice(1000.004, 1000), false, 'rounding to the cent');
    assert.equal(threeWayMatch([line({ invoicePrice: 990 })]).lines[0].result, 'MATCHED', 'a lower price is accepted');
});

test('an invoice above the PO price is refused when entered, at the GRN, and at approval even with a reason', () => {
    const svc = read('src/services/procurement/supplier-invoice.service.ts');
    const grn = svc.slice(svc.indexOf('static async createFromGrnTx('), svc.indexOf('static async create('));
    assert.match(grn, /if \(isGrnInvoiceAbovePo\(goods, poValue\)\) \{\s+throw AppError\.badRequest\(`INVOICE_ABOVE_PO_PRICE/);
    const create = svc.slice(svc.indexOf('static async create('), svc.indexOf('static async createService('));
    assert.match(create, /isAbovePoPrice\(m\.unitPrice, byId\.get\(poItemId\)!\.orderedPrice\)/);
    const approve = svc.slice(svc.indexOf('static async approve('), svc.indexOf('static async reject('));
    const refuse = approve.indexOf("recheck.lines.some((l) => l.result === 'ABOVE_PO_PRICE')");
    assert.ok(refuse > 0 && refuse < approve.indexOf('overrideReason && overrideReason.trim().length >= 5'), 'refused before any override reason is looked at');
    assert.doesNotMatch(read('src/services/procurement/procurement-config.ts'), /MATCH_PRICE_TOLERANCE/, 'no price tolerance setting any more');
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
