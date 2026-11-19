import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { confirmationsSinceReturn, figuresAfterRemoval, planApproval, stageLabel } from '../../src/lib/approval-chain-rules';
import { isReadyForOspQuality } from '../../src/lib/invoice-contractor-confirm-rules';
import { firstApplicableLevel, mayActOnLevel, roleLabel, type GateActor } from '../../src/lib/gate-eligibility';

const base = { waiting: true, stageLabel: 'QC Officer', userId: 'u1', canAct: true, inScope: true, history: [] as Array<{ userId: string; stage: string; action: string }> };

test('a person who holds the step, in the invoice\'s area, can approve it', () => {
    assert.deepEqual(planApproval(base), { ok: true });
});

test('an invoice with no open step, a step the person does not hold, or another area cannot be approved', () => {
    const idle = planApproval({ ...base, waiting: false });
    assert.equal(!idle.ok && idle.reason, 'NOT_IN_CHAIN');
    const noStep = planApproval({ ...base, canAct: false });
    assert.equal(!noStep.ok && noStep.reason, 'NO_PERMISSION_FOR_STAGE');
    assert.match(!noStep.ok ? noStep.message : '', /QC Officer/);
    const away = planApproval({ ...base, inScope: false });
    assert.equal(!away.ok && away.reason, 'OUTSIDE_AREA');
});

test('one person cannot approve two different steps of the same invoice (separation of duties)', () => {
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

test('steps read as people, not codes', () => {
    assert.equal(stageLabel('CONTRACTOR'), 'Contractor');
    assert.equal(stageLabel('AREA_MANAGER'), 'Area Manager (ARM)');
    assert.equal(stageLabel('CONFIRMED'), 'Area approved');
    assert.equal(roleLabel('SOME_NEW_ROLE'), 'Some New Role');
});

test('taking service orders out recalculates the invoice: the total follows the orders that stay, deductions follow in proportion', () => {
    const f = figuresAfterRemoval({ oldTotal: 1000, newTotal: 750, retention: 100, wht: 50, advance: 200 });
    assert.deepEqual(f, { totalAmount: 750, retentionAmount: 75, whtAmount: 37.5, advanceDeduction: 200 });
    assert.equal(figuresAfterRemoval({ oldTotal: 1000, newTotal: 150, retention: 100, wht: 0, advance: 200 }).advanceDeduction, 150, 'an advance never exceeds the new total');
    assert.equal(figuresAfterRemoval({ oldTotal: 0, newTotal: 0, retention: 0, wht: 0, advance: 0 }).totalAmount, 0);
});

test('an invoice reaches OSP Quality only after the area approval gate is done', () => {
    const ok = { confirmStage: 'CONFIRMED', contractorConfirmStatus: 'CONFIRMED', statusA: 'PENDING_SF_AUDIT' };
    assert.equal(isReadyForOspQuality(ok), true);
    assert.equal(isReadyForOspQuality({ ...ok, contractorConfirmStatus: 'AWAITING' }), false);
    assert.equal(isReadyForOspQuality({ ...ok, confirmStage: 'QC_OFFICER' }), false);
    assert.equal(isReadyForOspQuality({ ...ok, confirmStage: 'IN_GATE' }), false);
    assert.equal(isReadyForOspQuality({ ...ok, statusA: 'SF_AUDIT_APPROVED' }), false);
});

const person = (over: Partial<GateActor> & { role?: string } = {}): GateActor => ({
    id: 'p1', contractorId: null, accessibleOpmcIds: ['A'], systemRole: over.role ? { code: over.role, isActive: true } : null, sectionAssignments: [], ...over,
});
const roleLevel = { assignee: 'ROLE', requiredPermission: 'invoice.confirm.qc', eligibleRoles: ['QC_OFFICER'], specificUserId: null };
const contractorLevel = { assignee: 'ORDER_CONTRACTOR', requiredPermission: 'contractor.write', eligibleRoles: ['CONTRACTOR'], specificUserId: null };

test('a step needs its capability and an eligible role, inside the invoice\'s area', () => {
    const qc = person({ role: 'QC_OFFICER' });
    assert.equal(mayActOnLevel(qc, ['invoice.confirm.qc'], roleLevel, { opmcId: 'A' }), true);
    assert.equal(mayActOnLevel(qc, [], roleLevel, { opmcId: 'A' }), false, 'no capability');
    assert.equal(mayActOnLevel(qc, ['invoice.confirm.qc'], roleLevel, { opmcId: 'B' }), false, 'other area');
    assert.equal(mayActOnLevel(person({ role: 'ENGINEER' }), ['invoice.confirm.qc'], roleLevel, { opmcId: 'A' }), false, 'wrong role');
    assert.equal(mayActOnLevel(person({ role: 'ENGINEER' }), ['invoice.confirm.qc', 'admin.rbac'], roleLevel, { opmcId: 'B' }), true, 'an administrator acts in every area');
});

test('the contractor step belongs to the invoice\'s own contractor, and an administrator does not stand in for it', () => {
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
});

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../..', p), 'utf8');

test('wiring: orders are passed by Coordinator and QC, the engineer creates the invoice, the invoice is accepted by the contractor and approved by the Area Manager', () => {
    // the invoice gate (still created by the earlier migration) is shortened to Contractor -> Area Manager by the v2 migration
    const m1 = read('prisma/migrations/20261209000000_invoice_approval_gate/migration.sql');
    assert.ok(m1.includes("'INVOICE', 'CREATED', 'AREA_APPROVED'") && m1.includes("'MARK_INVOICE_AREA_APPROVED'") && m1.includes('"InvoiceSodRemoval"'));
    const m = read('prisma/migrations/20261210000000_invoice_flow_v2/migration.sql');
    assert.ok(m.includes("'SERVICE_ORDER', 'COMPLETED', 'READY_FOR_INVOICE'") && m.includes("'MARK_SOD_READY_FOR_INVOICE'"), 'the order gate');
    assert.ok(m.indexOf("'AREA_COORDINATOR', 'invoice.confirm.coordinator'") < m.indexOf("'QC_OFFICER',       'invoice.confirm.qc'"), 'Coordinator before QC');
    assert.ok(m.includes('"Invoice" ADD COLUMN IF NOT EXISTS "opmcId"') && m.includes('"invoicingHeldAt"'), 'the invoice has its own area; orders can be held back');
    assert.ok(m.includes("\"requiredRole\" IN ('AREA_COORDINATOR', 'QC_OFFICER', 'ENGINEER')") && m.includes("WHEN 'CONTRACTOR' THEN 1 WHEN 'AREA_MANAGER' THEN 2"), 'the invoice gate keeps Contractor then Area Manager');
    const gen = read('src/services/invoice/invoice.generator.service.ts');
    assert.ok(gen.includes("confirmStage: 'IN_GATE'") && gen.includes('InvoiceGateService.startFor'), 'a new invoice starts the gate');
    assert.ok(gen.includes("createHash('sha1')"), 'a selection of orders, not a contractor-month, is the idempotency identity');
    assert.ok(gen.includes('allowLate') && gen.includes('opmcId: other.opmcId'), 'late SODs are allowed and the invoice stores its area');
    const svc = read('src/services/invoice/invoice-gate.service.ts');
    assert.ok(svc.includes('ProcessGateEngine.advanceGate') && svc.includes('ProcessGateEngine.startGate'), 'the service drives the gate engine');
    assert.ok(svc.includes('LedgerService.reverseTransaction') && svc.includes("'INVOICE_GENERATION'"), 'taking orders out reverses and re-posts the ledger');
    assert.ok(svc.includes('isInvoicable: false') && svc.includes('invoiceId: null'), 'removed orders go back to the verification list');
    assert.ok(svc.includes('FOR UPDATE'), 'the invoice row is locked while orders are taken out');
    const dispatcher = read('src/services/approval/domain-dispatcher.service.ts');
    assert.ok(dispatcher.includes("case 'MARK_INVOICE_AREA_APPROVED'") && dispatcher.includes("case 'MARK_SOD_READY_FOR_INVOICE'"));
    assert.ok(read('src/app/api/invoices/confirmations/route.ts').includes('REMOVE_SODS'));
    assert.ok(read('src/app/api/contractor-portal/invoice-approvals/route.ts').includes('CONTRACTOR_WRITE'));
    const orders = read('src/services/service-order/sod-approval.service.ts');
    assert.ok(orders.includes('ProcessGateEngine.advanceGate') && orders.includes('startMany') && orders.includes('SOD_CHAIN_ENTRY_STATUSES'), 'the order approval is a bulk gate queue by area');
    assert.ok(read('src/app/api/invoicing/route.ts').includes('SOD_INVOICE') && read('src/services/invoice/invoicing.service.ts').includes('isLateSod'), 'the engineer creates the invoices, late SODs are marked');
    assert.ok(!read('src/services/service-order/sync/sod-status.writer.ts').includes('sodApprovalStage'), 'the status writer does not start an approval for an order');
});

after(() => { setTimeout(() => process.exit(process.exitCode ?? 0), 100).unref?.(); });
