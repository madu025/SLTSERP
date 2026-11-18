import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { legacyApprovalAllowed, planOspStep, type OspInvoiceState } from '../../src/lib/invoice-osp-approval-rules';

const verified: OspInvoiceState = { approvalFlow: 'OSP_CHAIN', approvalStatus: 'DRAFT', statusA: 'SF_AUDIT_APPROVED', contractorConfirmStatus: 'CONFIRMED', confirmStage: 'CONFIRMED', ospSentById: null };
const sent: OspInvoiceState = { ...verified, approvalStatus: 'PENDING_OSP_APPROVAL', ospSentById: 'finance-1' };

test('Finance can send an invoice that OSP Quality verified and the contractor confirmed', () => {
    assert.deepEqual(planOspStep({ invoice: verified, action: 'SEND', actorId: 'finance-1' }), { ok: true, next: 'PENDING_OSP_APPROVAL' });
});

test('an invoice that is not verified, or not confirmed by the contractor and the area chain, cannot be sent', () => {
    for (const patch of [{ statusA: 'PENDING_SF_AUDIT' }, { contractorConfirmStatus: 'AWAITING' }, { contractorConfirmStatus: 'DISPUTED' }, { confirmStage: 'QC_OFFICER' }]) {
        const r = planOspStep({ invoice: { ...verified, ...patch }, action: 'SEND', actorId: 'finance-1' });
        assert.equal(!r.ok && r.reason, 'NOT_VERIFIED', JSON.stringify(patch));
    }
});

test('an invoice cannot be sent twice', () => {
    const r = planOspStep({ invoice: sent, action: 'SEND', actorId: 'finance-1' });
    assert.equal(!r.ok && r.reason, 'WRONG_STATE');
});

test('an OSP manager approves an invoice Finance sent, but not one they sent themselves', () => {
    assert.deepEqual(planOspStep({ invoice: sent, action: 'APPROVE', actorId: 'manager-1' }), { ok: true, next: 'APPROVED' });
    const self = planOspStep({ invoice: sent, action: 'APPROVE', actorId: 'finance-1' });
    assert.equal(!self.ok && self.reason, 'SAME_PERSON');
});

test('only an invoice waiting for the OSP managers can be approved or returned', () => {
    for (const action of ['APPROVE', 'RETURN'] as const) {
        const r = planOspStep({ invoice: verified, action, actorId: 'manager-1', note: 'because' });
        assert.equal(!r.ok && r.reason, 'WRONG_STATE', action);
    }
});

test('a return needs a reason and sends the invoice back to Finance', () => {
    assert.deepEqual(planOspStep({ invoice: sent, action: 'RETURN', actorId: 'manager-1', note: 'Wrong rate' }), { ok: true, next: 'DRAFT' });
    for (const note of [undefined, '', ' x ']) {
        const r = planOspStep({ invoice: sent, action: 'RETURN', actorId: 'manager-1', note });
        assert.equal(!r.ok && r.reason, 'REASON_REQUIRED', String(note));
    }
});

test('older invoices keep the old single approval and are not part of the OSP chain', () => {
    assert.equal(legacyApprovalAllowed('LEGACY'), true);
    assert.equal(legacyApprovalAllowed('OSP_CHAIN'), false);
    const r = planOspStep({ invoice: { ...verified, approvalFlow: 'LEGACY' }, action: 'SEND', actorId: 'finance-1' });
    assert.equal(!r.ok && r.reason, 'NOT_OSP_FLOW');
});

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../..', p), 'utf8');

test('wiring: new invoices use the chain, the old approval refuses them, and the routes are guarded by the right capabilities', () => {
    assert.ok(read('src/services/invoice/invoice.generator.service.ts').includes("approvalFlow: 'OSP_CHAIN'"));
    const old = read('src/services/finance/invoice-approval.service.ts');
    assert.equal(old.split('legacyApprovalAllowed').length - 1, 3, 'imported once and checked on both approve and reject');
    const svc = read('src/services/invoice/invoice-osp-approval.service.ts');
    assert.ok(svc.includes('approvalStatus: inv.approvalStatus, approvalFlow'), 'a decision is a conditional update, so it can only win once');
    assert.ok(svc.includes('planOspStep('));
    assert.ok(read('src/app/api/finance/invoice-dispatch/route.ts').includes('FINANCE_WRITE'));
    assert.ok(read('src/app/api/invoices/osp-approvals/route.ts').includes('INVOICE_OSP_APPROVE'));
    assert.ok(read('src/config/rbac-permissions.ts').includes("INVOICE_OSP_APPROVE: 'invoice.osp.approve'"));
    assert.ok(read('src/config/rbac-bootstrap.ts').includes('INVOICE_OSP_APPROVE'));
    const m = read('prisma/migrations/20261206000000_invoice_osp_approval/migration.sql');
    assert.ok(m.includes('"approvalFlow" TEXT NOT NULL DEFAULT \'LEGACY\''), 'older invoices stay on the old approval');
    assert.ok(m.includes("'invoice.osp.approve'"));
    const caps = read('src/config/page-capabilities.ts');
    assert.ok(caps.includes("prefix: '/invoices/osp-approvals'") && caps.includes("prefix: '/finance/invoice-dispatch'"));
});

after(() => { setTimeout(() => process.exit(process.exitCode ?? 0), 100).unref?.(); });
