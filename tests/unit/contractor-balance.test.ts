import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildContractorBalance, monthPeriod, type Movement } from '../../src/lib/contractor-balance-rules';

/** Contractor material balance through the SOD workflow (R-KX check, 28 Nov 2026). */
const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const item = { itemId: 'dw', code: 'DW', name: 'Drop wire', unit: 'm' };
const mv = (kind: Movement['kind'], qty: number, at: string, teamId: string | null = null): Movement => ({ ...item, kind, qty, at: new Date(at), teamId });

test('issued - used - wastage - accepted returns = expected, compared with the stock in hand', () => {
    const moves = [mv('ISSUED', 600, '2026-11-28'), mv('USED', 100, '2026-11-28', 't1'), mv('USED', 30, '2026-11-28', 't1'), mv('WASTAGE', 5, '2026-11-28', 't1'), mv('RETURNED', 45, '2026-11-28')];
    const [r] = buildContractorBalance(moves, [{ ...item, quantity: 420 }]);
    assert.deepEqual([r.issued, r.used, r.wastage, r.returned, r.closing, r.inHand, r.variance], [600, 130, 5, 45, 420, 420, 0]);
    const [bad] = buildContractorBalance(moves, [{ ...item, quantity: 762 }]);
    assert.equal(bad.variance, 342, 'stock without a document is a variance, never hidden');
});

test('a month view: earlier movements form the opening, later ones are left out', () => {
    const moves = [mv('ISSUED', 500, '2026-10-05'), mv('USED', 200, '2026-10-20'), mv('ISSUED', 100, '2026-11-02'), mv('USED', 50, '2026-11-15'), mv('USED', 10, '2026-12-01')];
    const [r] = buildContractorBalance(moves, [{ ...item, quantity: 340 }], monthPeriod('November', 2026));
    assert.deepEqual([r.opening, r.issued, r.used, r.closing, r.expectedNow, r.variance], [300, 100, 50, 350, 340, 0]);
});

test('month names, numbers and YYYY-MM all select the month (the screen sends "July"; the old SQL wanted "2026-07")', () => {
    for (const m of ['July', 'july', '7', '07']) assert.equal(monthPeriod(m, '2026')?.start.toISOString(), '2026-07-01T00:00:00.000Z');
    assert.equal(monthPeriod('2026-07')?.end.toISOString(), '2026-08-01T00:00:00.000Z');
    assert.equal(monthPeriod('ALL'), null);
    assert.equal(monthPeriod(undefined), null);
});

test('a team view shows only that team\'s SOD lines', () => {
    const moves = [mv('ISSUED', 100, '2026-11-01'), mv('USED', 10, '2026-11-02', 't1'), mv('USED', 20, '2026-11-02', 't2')];
    const [r] = buildContractorBalance(moves, [{ ...item, quantity: 70 }], null, 't1');
    assert.equal(r.used, 10);
    assert.equal(r.variance, 0);
});

test('a rollback gives back only lines that took stock from a batch', () => {
    const svc = read('src/services/service-order/sod.material.service.ts');
    const rollback = svc.slice(svc.indexOf('static async rollbackMaterialUsage'));
    assert.match(rollback, /if \(!isDecrementingUsage\) continue;\s*\/\/[^\n]*\n(\s*\/\/[^\n]*\n)*\s*if \(!m\.batchId\) continue;/);
});

test('the DISAPPEARED sweep gives the material back before it clears the contractor', () => {
    const svc = read('src/services/service-order/sod.sync.service.ts');
    const at = svc.indexOf("rollbackMaterialUsage(tx, disappearedSod.id, 'PORTAL_SWEEP')");
    const clear = svc.indexOf('contractorId: null', at - 2000);
    assert.ok(at > 0 && clear > at, 'rollback must come before contractorId: null');
});

test('a contractor return goes to the store that issued the item, not to any MAIN store', () => {
    const svc = read('src/services/inventory/contractor-inventory.service.ts');
    const create = svc.slice(svc.indexOf('static async createMaterialReturn'), svc.indexOf('static async getContractorStockDashboard'));
    assert.doesNotMatch(create, /type: 'MAIN'/);
    assert.match(create, /resolveReturnStoreId/);
});

test('balance screens no longer read COMPLETED only or the requested return quantity', () => {
    const tx = read('src/services/inventory/transaction.service.ts');
    const rec = tx.slice(tx.indexOf('static async getReconciliation'), tx.indexOf('static async generateBalanceSheet'));
    assert.doesNotMatch(rec, /sltsStatus: 'COMPLETED'/);
    assert.match(rec, /ContractorBalanceService\.balance/);
    const ci = read('src/services/inventory/contractor-inventory.service.ts');
    assert.doesNotMatch(ci, /fn_contractor_balance_sheet\(\s*\$\{/);
    const rules = read('src/services/inventory/contractor-balance.service.ts');
    assert.match(rules, /"acceptedQuantity"/);
    assert.match(rules, /u\."batchId" IS NOT NULL/);
});

test('an HO PAT rejection keeps the material used on the order (owner, 28 Nov 2026)', () => {
    const svc = read('src/services/service-order/sod.sync.service.ts');
    assert.doesNotMatch(svc, /rollbackMaterialUsage\(tx, order\.id, 'HO_REJECT'\)/);
    // only the billing side is reversed: revenue and the contractor WIP accrual, never the material cost
    assert.match(svc, /rollbackSodTransaction\(tx, order\.id, undefined, \['SOD_REVENUE', 'SOD_WIP_ACCRUAL'\]\)/);
});
