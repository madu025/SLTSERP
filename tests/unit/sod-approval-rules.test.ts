import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { confirmationsSinceReturn, planApproval, SOD_CHAIN_ENTRY_STATUSES } from '../../src/lib/sod-approval-rules';

const all = new Set(['AREA_COORDINATOR', 'QC_OFFICER', 'AREA_ENGINEER', 'AREA_MANAGER']);
const base = { userId: 'u1', userStages: all, inScope: true, history: [] as Array<{ userId: string; stage: string; action: string }>, areaHasEngineer: true };

test('the chain runs Area Coordinator, QC Officer, Engineer, Area Manager, then confirmed', () => {
    assert.deepEqual(planApproval({ ...base, stage: 'AREA_COORDINATOR' }), { ok: true, next: 'QC_OFFICER' });
    assert.deepEqual(planApproval({ ...base, stage: 'QC_OFFICER' }), { ok: true, next: 'AREA_ENGINEER' });
    assert.deepEqual(planApproval({ ...base, stage: 'AREA_ENGINEER' }), { ok: true, next: 'AREA_MANAGER' });
    assert.deepEqual(planApproval({ ...base, stage: 'AREA_MANAGER' }), { ok: true, next: 'CONFIRMED' });
});

test('the Engineer stage is skipped in an area that has none', () => {
    assert.deepEqual(planApproval({ ...base, stage: 'QC_OFFICER', areaHasEngineer: false }), { ok: true, next: 'AREA_MANAGER' });
});

test('a person can only approve the stage they hold', () => {
    const r = planApproval({ ...base, stage: 'QC_OFFICER', userStages: new Set(['AREA_COORDINATOR']) });
    assert.equal(r.ok, false);
    assert.equal(!r.ok && r.reason, 'NO_PERMISSION_FOR_STAGE');
});

test('an order outside the area, or not in the chain, cannot be approved', () => {
    const out = planApproval({ ...base, stage: 'AREA_COORDINATOR', inScope: false });
    assert.equal(!out.ok && out.reason, 'OUTSIDE_AREA');
    for (const stage of [null, 'CONFIRMED', 'nonsense']) {
        const r = planApproval({ ...base, stage });
        assert.equal(!r.ok && r.reason, 'NOT_IN_CHAIN', String(stage));
    }
});

test('one person cannot approve two different stages of the same order (separation of duties)', () => {
    const r = planApproval({ ...base, stage: 'QC_OFFICER', history: [{ userId: 'u1', stage: 'AREA_COORDINATOR', action: 'CONFIRMED' }] });
    assert.equal(!r.ok && r.reason, 'SAME_PERSON_TWO_STAGES');
    // somebody else may
    assert.equal(planApproval({ ...base, userId: 'u2', stage: 'QC_OFFICER', history: [{ userId: 'u1', stage: 'AREA_COORDINATOR', action: 'CONFIRMED' }] }).ok, true);
});

test('after a return the chain starts again, so earlier approvals no longer block anyone', () => {
    const history = [
        { userId: 'u1', stage: 'AREA_COORDINATOR', action: 'CONFIRMED' },
        { userId: 'u2', stage: 'QC_OFFICER', action: 'RETURNED' },
    ];
    assert.deepEqual(confirmationsSinceReturn(history), []);
    assert.equal(planApproval({ ...base, userId: 'u1', stage: 'AREA_COORDINATOR', history }).ok, true);
    assert.equal(planApproval({ ...base, userId: 'u1', stage: 'QC_OFFICER', history: [...history, { userId: 'u1', stage: 'AREA_COORDINATOR', action: 'CONFIRMED' }] }).ok, false);
});

test('only finished statuses start the chain', () => {
    assert.deepEqual([...SOD_CHAIN_ENTRY_STATUSES].sort(), ['COMPLETED', 'INSTALL_CLOSED', 'PROV_CLOSED']);
});

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../..', p), 'utf8');

test('wiring: finishing an order starts the chain, only the last stage makes it invoicable, direct verification is for legacy orders', async () => {
    assert.ok(read('src/services/service-order/sync/sod-status.writer.ts').includes("data.sodApprovalStage = 'AREA_COORDINATOR'"));
    const svc = read('src/services/service-order/sod-approval.service.ts');
    assert.ok(svc.includes("sodApprovalStage: 'CONFIRMED', isInvoicable: true"));
    assert.ok(svc.includes('validateSodForInvoicing(o)'));
    assert.ok(read('src/services/service-order/index.ts').includes('sodApprovalStage: null'));
    assert.ok(read('src/app/api/service-orders/approvals/route.ts').includes('INVOICE_CONFIRM_MANAGER'));
    const m = read('prisma/migrations/20261204000000_sod_approval_chain/migration.sql');
    assert.ok(m.includes('ADD COLUMN IF NOT EXISTS "sodApprovalStage" TEXT;'));
    assert.ok(m.includes('CREATE TABLE IF NOT EXISTS "SodApproval"'));
    const caps = read('src/config/page-capabilities.ts');
    assert.ok(caps.includes("prefix: '/service-orders/approvals'"));
});

after(() => { setTimeout(() => process.exit(process.exitCode ?? 0), 100).unref?.(); });
