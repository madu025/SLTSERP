import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readOpeningRows, openingSubmitGate, openingApproveGate, sheetDate, linesTotal } from '../../src/lib/opening-stock-rules';
import { firstFailure } from '../../src/lib/purchase-flow-gates';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const items = [
    { id: 'i1', code: 'OSP-CHOOK', name: 'C-Hook', unit: 'Nos' },
    { id: 'i2', code: 'OSP-DW-F1', name: 'Drop wire F1', unit: 'm' },
];
const ok = { storeChosen: true, countDate: '2026-11-27', today: '2026-11-27', countSheetAttached: true, alreadyLoaded: [] as string[] };

test('a correct sheet passes; codes match whatever their case', () => {
    const lines = readOpeningRows([{ row: 2, code: 'osp-chook', quantity: 1000, unitCost: '150' }, { row: 3, code: 'OSP-DW-F1', quantity: '2,500.5', unitCost: 'Rs. 42.5' }], items);
    assert.deepEqual(lines.map((l) => [l.itemId, l.quantity, l.unitCost, l.errors.length]), [['i1', 1000, 150, 0], ['i2', 2500.5, 42.5, 0]]);
    assert.equal(firstFailure(openingSubmitGate({ ...ok, lines })), null);
    assert.deepEqual(linesTotal(lines), { qty: 3500.5, value: 256271.25 });
});

test('each row says what is wrong with it', () => {
    const lines = readOpeningRows([
        { row: 2, code: 'NOPE', quantity: 1, unitCost: 1 },
        { row: 3, code: 'OSP-CHOOK', quantity: 2.5, unitCost: 10 },
        { row: 4, code: 'OSP-DW-F1', quantity: 10, unitCost: 0 },
        { row: 5, code: 'OSP-DW-F1', quantity: 5, unitCost: 3, expiryDate: 'soon' },
    ], items);
    assert.match(lines[0].errors[0], /not in the item list/);
    assert.match(lines[1].errors[0], /Whole numbers only for Nos/);
    assert.match(lines[2].errors[0], /Unit cost must be above zero/);
    assert.ok(lines[3].errors.some((e) => /Listed twice \(also row 4\)/.test(e)));
    assert.ok(lines[3].errors.some((e) => /Expiry date is not a date/.test(e)));
    assert.match(firstFailure(openingSubmitGate({ ...ok, lines }))!.text, /Fix 4 row\(s\)/);
});

test('an item is loaded once per store; the count needs its date and its signed sheet', () => {
    const lines = readOpeningRows([{ row: 2, code: 'OSP-CHOOK', quantity: 10, unitCost: 150 }], items);
    assert.match(firstFailure(openingSubmitGate({ ...ok, lines, alreadyLoaded: ['i1'] }))!.text, /Already loaded in this store \(use a cycle count to correct\): OSP-CHOOK/);
    assert.match(firstFailure(openingSubmitGate({ ...ok, lines, countDate: '2026-11-28' }))!.text, /cannot be in the future/);
    assert.match(firstFailure(openingSubmitGate({ ...ok, lines, countSheetAttached: false }))!.text, /signed physical count sheet/);
    assert.match(firstFailure(openingSubmitGate({ ...ok, lines: [] }))!.text, /at least one item/);
});

test('the person who submitted cannot approve; a rejection needs its reason', () => {
    const base = { status: 'SUBMITTED', actorId: 'u1', createdById: 'u1', isAdmin: false, rejecting: false, alreadyLoaded: [] as string[] };
    assert.match(firstFailure(openingApproveGate(base))!.text, /You submitted this load, so another person approves it/);
    assert.equal(firstFailure(openingApproveGate({ ...base, actorId: 'u2' })), null);
    assert.match(firstFailure(openingApproveGate({ ...base, actorId: 'u2', rejecting: true, reason: '' }))!.text, /Say why/);
    assert.match(firstFailure(openingApproveGate({ ...base, actorId: 'u2', status: 'APPROVED' }))!.text, /approved/);
    assert.match(firstFailure(openingApproveGate({ ...base, actorId: 'u2', alreadyLoaded: ['i1'] }))!.text, /got stock in this store since it was submitted/);
});

test('Excel dates are read whatever their form', () => {
    assert.equal(sheetDate(46353), '2026-11-27');
    assert.equal(sheetDate('27/11/2026'), '2026-11-27');
    assert.equal(sheetDate('2026-11-27'), '2026-11-27');
    assert.equal(sheetDate(''), null);
    assert.equal(sheetDate('next week'), 'invalid');
});

test('the server applies the same checks, in one transaction, with a numbered batch and an OPENING_BALANCE ledger entry', () => {
    const svc = read('src/services/inventory/opening-stock.service.ts');
    assert.match(svc, /firstFailure\(openingSubmitGate\(/);
    assert.match(svc, /firstFailure\(openingApproveGate\(/);
    assert.match(svc, /FOR UPDATE/);
    assert.match(svc, /transactionType: 'OPENING_BALANCE'/);
    assert.match(svc, /tx\.inventoryBatch\.create\(\{ data: \{ batchNumber, itemId: line\.itemId, initialQty: qty, costPrice: cost/);
    assert.match(svc, /assertStoreWriteAccess/);
    // setting stock directly (no second person) is left to administrators
    assert.match(read('src/app/api/inventory/stock/route.ts'), /permissions: \[RBAC_PERMISSIONS\.ADMIN_RBAC\]/);
    assert.match(read('src/app/api/inventory/opening-stock/[id]/route.ts'), /permissions: \[RBAC_PERMISSIONS\.INVENTORY_APPROVE\]/);
});

test('Help and the assistant answer go-live stock questions from the opening stock guide', async () => {
    const { GuideService } = await import('../../src/services/guides/guide.service');
    const { RBAC_PERMISSIONS } = await import('../../src/config/rbac-permissions');
    const all = new Set<string>(Object.values(RBAC_PERMISSIONS));
    assert.equal(GuideService.lookup('how do I add opening stock to a store at go live', all).sections[0].id, 'submit');
    assert.equal(GuideService.lookup('approve opening stock load', all).sections[0].id, 'approve');
});

test('every screenshot of the opening stock guide exists', async () => {
    const { existsSync } = await import('node:fs');
    const { OPENING_STOCK_GUIDE } = await import('../../src/content/guides/opening-stock.guide');
    const images = OPENING_STOCK_GUIDE.sections.flatMap((s) => s.images ?? []);
    assert.ok(images.length >= 3);
    for (const im of images) assert.ok(existsSync(new URL(`../../public${im.src}`, import.meta.url)), `${im.src} is in public/`);
});
