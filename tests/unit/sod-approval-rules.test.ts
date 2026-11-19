import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { confirmationsSinceReturn, planApproval, sodStageLabel, SOD_CHAIN_ENTRY_STATUSES } from '../../src/lib/sod-approval-rules';
import { firstApplicableLevel, mayActOnLevel, roleLabel, type GateActor } from '../../src/lib/gate-eligibility';

const base = { waiting: true, stageLabel: 'QC Officer', userId: 'u1', canAct: true, inScope: true, history: [] as Array<{ userId: string; stage: string; action: string }> };

test('a person who holds the step, in the order\'s area, can approve it', () => {
    assert.deepEqual(planApproval(base), { ok: true });
});

test('an order with no open step, a step the person does not hold, or another area cannot be approved', () => {
    const idle = planApproval({ ...base, waiting: false });
    assert.equal(!idle.ok && idle.reason, 'NOT_IN_CHAIN');
    const noStep = planApproval({ ...base, canAct: false });
    assert.equal(!noStep.ok && noStep.reason, 'NO_PERMISSION_FOR_STAGE');
    assert.match(!noStep.ok ? noStep.message : '', /QC Officer/);
    const away = planApproval({ ...base, inScope: false });
    assert.equal(!away.ok && away.reason, 'OUTSIDE_AREA');
});

test('one person cannot approve two different steps of the same order (separation of duties)', () => {
    const r = planApproval({ ...base, history: [{ userId: 'u1', stage: 'AREA_COORDINATOR', action: 'CONFIRMED' }] });
    assert.equal(!r.ok && r.reason, 'SAME_PERSON_TWO_STAGES');
    assert.equal(planApproval({ ...base, userId: 'u2', history: [{ userId: 'u1', stage: 'AREA_COORDINATOR', action: 'CONFIRMED' }] }).ok, true);
});

test('after a return or a restart the chain starts again, so earlier approvals no longer block anyone', () => {
    for (const boundary of ['RETURNED', 'RESTARTED']) {
        const history = [{ userId: 'u1', stage: 'AREA_COORDINATOR', action: 'CONFIRMED' }, { userId: 'u2', stage: 'QC_OFFICER', action: boundary }];
        assert.deepEqual(confirmationsSinceReturn(history), []);
        assert.equal(planApproval({ ...base, history }).ok, true, boundary);
    }
});

test('only finished statuses start the chain, and stages read as people, not codes', () => {
    assert.deepEqual([...SOD_CHAIN_ENTRY_STATUSES].sort(), ['COMPLETED', 'INSTALL_CLOSED', 'PROV_CLOSED']);
    assert.equal(sodStageLabel('CONTRACTOR'), 'Contractor');
    assert.equal(sodStageLabel('AREA_MANAGER'), 'Area Manager (ARM)');
    assert.equal(sodStageLabel('CONFIRMED'), 'Approved for invoice');
    assert.equal(roleLabel('SOME_NEW_ROLE'), 'Some New Role');
});

const person = (over: Partial<GateActor> & { role?: string } = {}): GateActor => ({
    id: 'p1', contractorId: null, accessibleOpmcIds: ['A'], systemRole: over.role ? { code: over.role, isActive: true } : null, sectionAssignments: [], ...over,
});
const roleLevel = { assignee: 'ROLE', requiredPermission: 'invoice.confirm.qc', eligibleRoles: ['QC_OFFICER'], specificUserId: null };
const contractorLevel = { assignee: 'ORDER_CONTRACTOR', requiredPermission: 'contractor.write', eligibleRoles: ['CONTRACTOR'], specificUserId: null };

test('a step needs its capability and an eligible role, inside the order\'s area', () => {
    const qc = person({ role: 'QC_OFFICER' });
    assert.equal(mayActOnLevel(qc, ['invoice.confirm.qc'], roleLevel, { opmcId: 'A' }), true);
    assert.equal(mayActOnLevel(qc, [], roleLevel, { opmcId: 'A' }), false, 'no capability');
    assert.equal(mayActOnLevel(qc, ['invoice.confirm.qc'], roleLevel, { opmcId: 'B' }), false, 'other area');
    assert.equal(mayActOnLevel(person({ role: 'ENGINEER' }), ['invoice.confirm.qc'], roleLevel, { opmcId: 'A' }), false, 'wrong role');
    assert.equal(mayActOnLevel(person({ role: 'PROJECTS_QC_OFFICER' }), ['invoice.confirm.qc'], roleLevel, { opmcId: 'A' }), true, 'a role named after a section still matches');
    assert.equal(mayActOnLevel(person({ role: 'ENGINEER' }), ['invoice.confirm.qc', 'admin.rbac'], roleLevel, { opmcId: 'B' }), true, 'an administrator acts in every area');
});

test('the contractor step belongs to the order\'s own contractor, and an administrator does not stand in for it', () => {
    const own = person({ contractorId: 'C1', accessibleOpmcIds: [] });
    assert.equal(mayActOnLevel(own, ['contractor.write'], contractorLevel, { contractorId: 'C1' }), true);
    assert.equal(mayActOnLevel(own, ['contractor.write'], contractorLevel, { contractorId: 'C2' }), false, 'another contractor');
    assert.equal(mayActOnLevel(person({ role: 'ADMIN' }), ['contractor.write', 'admin.rbac'], contractorLevel, { contractorId: 'C1' }), false, 'an administrator is not the contractor');
});

test('a step flagged skip-when-nobody-holds-it is skipped only when nobody does', async () => {
    const levels = [{ n: 1 }, { n: 2, skipIfNoApprover: true }, { n: 3 }];
    assert.equal(await firstApplicableLevel(levels, 0, async () => true), 0);
    assert.equal(await firstApplicableLevel(levels, 1, async () => true), 1, 'somebody holds it');
    assert.equal(await firstApplicableLevel(levels, 1, async () => false), 2, 'nobody holds it: the next step applies');
    assert.equal(await firstApplicableLevel(levels, 3, async () => false), -1, 'no step left');
    assert.equal(await firstApplicableLevel([{ n: 1, skipIfNoApprover: true }], 0, async () => false), -1, 'every remaining step skipped');
});

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../..', p), 'utf8');

test('wiring: the chain is a gate policy in queue mode, in the agreed order, and the writer starts it', async () => {
    const m = read('prisma/migrations/20261208000000_sod_invoicing_gate/migration.sql');
    assert.ok(m.includes("'SERVICE_ORDER', 'COMPLETED', 'INVOICABLE'") && m.includes("'MARK_SOD_INVOICABLE'") && m.includes('"queueMode"'));
    const order = ['AREA_COORDINATOR', 'QC_OFFICER', 'CONTRACTOR', 'ENGINEER', 'AREA_MANAGER'].map((r) => m.indexOf(`'${r}', `, m.indexOf('CROSS JOIN')));
    assert.ok(order.every((i, n) => i > 0 && (n === 0 || i > order[n - 1])), 'Coordinator, QC, Contractor, Engineer, ARM in that order');
    assert.ok(/ENGINEER[^\n]*true\)/.test(m), 'the Engineer step is skipped in an area without one');
    assert.ok(m.includes("'ORDER_CONTRACTOR'"), 'the contractor step is the order\'s own contractor');
    const writer = read('src/services/service-order/sync/sod-status.writer.ts');
    assert.ok(writer.includes('data.sodApprovalStage = SOD_STAGE_RESTART') && writer.includes('SodApprovalService.startFor'));
    const svc = read('src/services/service-order/sod-approval.service.ts');
    assert.ok(svc.includes('ProcessGateEngine.advanceGate') && svc.includes('ProcessGateEngine.startGate'), 'the service drives the gate engine');
    assert.ok(read('src/services/approval/domain-dispatcher.service.ts').includes("case 'MARK_SOD_INVOICABLE'"));
    assert.ok(read('src/services/service-order/sod-invoicable.action.ts').includes('validateSodForInvoicing(order)'), 'the last approval checks the order can be billed');
    assert.ok(read('src/services/service-order/index.ts').includes('sodApprovalStage: null,'), 'invoicing verification still skips orders in the chain');
    const caps = read('src/config/page-capabilities.ts');
    assert.ok(caps.includes("prefix: '/service-orders/approvals'"));
    assert.ok(read('src/app/api/contractor-portal/sod-approvals/route.ts').includes('CONTRACTOR_WRITE'));
});

after(() => { setTimeout(() => process.exit(process.exitCode ?? 0), 100).unref?.(); });
