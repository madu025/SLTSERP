import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { grnGateChecks, grnSodBlocked, isGrnInvoiceAbovePo, poValueOfAccepted, type GrnGateInput } from '../../src/lib/grn-gate';

const base: GrnGateInput = {
    poRequired: true, poChosen: true, hoOrder: true, receiverId: 'sm', poRecordedById: 'proc', lines: [{ name: 'C-Hook', unit: 'Nos', open: 400, unitPrice: 160, accepted: 400, rejected: 0, rejectReason: '' }],
    oracleGrnNumber: 'ORA-1', invoiceNumber: 'INV-1', invoiceDate: '2026-11-27', invoiceGoods: 64000, invoiceTax: 0, scanAttached: true,
};
const failing = (i: GrnGateInput) => grnGateChecks(i).filter((c) => !c.ok).map((c) => c.key);

test('a complete GRN at the PO price passes every check (the screen unlocks "Confirm receipt")', () => {
    assert.deepEqual(failing(base), []);
    assert.equal(poValueOfAccepted(base.lines), 64000);
});

test('the GRN gate refuses what the server refuses: PO, SoD, open quantity, reason, HO invoice fields and the PO price', () => {
    assert.deepEqual(failing({ ...base, poChosen: false }), ['po']);
    assert.deepEqual(failing({ ...base, poRecordedById: 'sm' }), ['sod'], 'who recorded the PO does not receive it');
    assert.equal(grnSodBlocked('sm', 'sm', true), false, 'administrators excepted, as on the server');
    assert.deepEqual(failing({ ...base, lines: [{ ...base.lines[0], accepted: 401 }], invoiceGoods: 64160 }), ['open']);
    assert.deepEqual(failing({ ...base, lines: [{ ...base.lines[0], accepted: 350, rejected: 50, rejectReason: 'x' }], invoiceGoods: 56000 }), ['reason']);
    assert.deepEqual(failing({ ...base, oracleGrnNumber: '' }), ['oracle']);
    assert.deepEqual(failing({ ...base, scanAttached: false }), ['scan']);
    assert.deepEqual(failing({ ...base, invoiceGoods: 64000.02 }), ['price']);
    assert.equal(isGrnInvoiceAbovePo(64000.01, 64000), false, 'rounding to the cent');
});

test('server and screen use the same rules', () => {
    const grn = readFileSync(new URL('../../src/services/inventory/grn.service.ts', import.meta.url), 'utf8');
    assert.match(grn, /grnSodBlocked\(receivedById, po\.createdById/);
    assert.match(grn, /trim\(\)\.length < GRN_REJECT_REASON_MIN\)/);
    assert.match(grn, /trim\(\)\.length < ORACLE_GRN_MIN\)/);
    assert.match(readFileSync(new URL('../../src/services/procurement/supplier-invoice.service.ts', import.meta.url), 'utf8'), /isGrnInvoiceAbovePo\(goods, poValue\)/);
    const page = readFileSync(new URL('../../src/app/inventory/grn/page.tsx', import.meta.url), 'utf8');
    assert.match(page, /grnGateChecks\(\{/);
    assert.match(page, /disabled=\{!gate\.ok \|\| createGRNMutation\.isPending/);
});
