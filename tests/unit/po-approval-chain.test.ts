import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    FIRST_PO_STAGE, PO_STAGES, PO_STAGE_PERMISSION, assertRemarks, isPoStage, needsExecutiveApproval, nextStage, previousStage,
} from '../../src/lib/po-approval-chain';
import { approvalEntryHash, firstBrokenEntry, type PoApprovalEntry } from '../../src/lib/po-approval-hash';
import { canTransitionPo, isPoEditable, valueAmendment } from '../../src/lib/procurement-rules';
import { RBAC_PERMISSIONS, RBAC_PERMISSION_DEFINITIONS } from '../../src/config/rbac-permissions';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('the chain has three mandatory steps in a fixed order', () => {
    assert.deepEqual([...PO_STAGES], ['L1', 'L2', 'L3']);
    assert.equal(FIRST_PO_STAGE, 'L1');
    assert.equal(nextStage('L1'), 'L2');
    assert.equal(nextStage('L2'), 'L3');
    assert.equal(nextStage('L3'), null);
    assert.equal(isPoStage('L2'), true);
    assert.equal(isPoStage('L9'), false);
});

test('a return goes one step back and from step 1 back to the person who raised the order', () => {
    assert.equal(previousStage('L3'), 'L2');
    assert.equal(previousStage('L2'), 'L1');
    assert.equal(previousStage('L1'), null);
});

test('every step is its own capability and each capability is in the catalog', () => {
    const codes = new Set<string>(RBAC_PERMISSION_DEFINITIONS.map((p) => p.code));
    const stepCodes = PO_STAGES.map((s) => PO_STAGE_PERMISSION[s]);
    assert.equal(new Set(stepCodes).size, 3, 'three different capabilities');
    for (const c of [...stepCodes, RBAC_PERMISSIONS.PROCUREMENT_INVOICE_APPROVE_EXECUTIVE]) assert.ok(codes.has(c), `${c} is in the catalog`);
});

test('a return, a cancellation and a reset need remarks; an approval does not', () => {
    assert.ok(assertRemarks('RETURNED', ' ab '), 'too short is refused');
    assert.equal(assertRemarks('RETURNED', 'price too high'), 'price too high');
    assert.ok(assertRemarks('CANCELLED', null));
    assert.ok(assertRemarks('RESET', ''));
    assert.equal(assertRemarks('APPROVED', null), null);
    assert.equal(assertRemarks('APPROVED', 'ok'), 'ok');
});

test('the executive approval applies only above the threshold', () => {
    assert.equal(needsExecutiveApproval(5_000_000, 5_000_000), false, 'exactly at the threshold is still finance only');
    assert.equal(needsExecutiveApproval(5_000_000.01, 5_000_000), true);
    assert.equal(needsExecutiveApproval(100, 50), true, 'the admin can lower it');
    assert.equal(needsExecutiveApproval(9_999_999, 20_000_000), false, 'and raise it');
    assert.equal(needsExecutiveApproval(1, Number.NaN), false);
});

test('returned orders can be amended and resubmitted, and approved ones restart the chain when their value changes', () => {
    assert.equal(canTransitionPo('PENDING_APPROVAL', 'RETURNED'), true);
    assert.equal(canTransitionPo('RETURNED', 'PENDING_APPROVAL'), true);
    assert.equal(canTransitionPo('RETURNED', 'ISSUED'), false, 'a returned order cannot be issued');
    assert.equal(canTransitionPo('PENDING_APPROVAL', 'ISSUED'), false);
    assert.equal(isPoEditable('RETURNED', false), true);
    assert.equal(valueAmendment('RETURNED'), 'ALLOWED');
    assert.equal(valueAmendment('PENDING_APPROVAL'), 'RESTARTS_CHAIN');
    assert.equal(valueAmendment('APPROVED'), 'RESTARTS_CHAIN');
    assert.equal(valueAmendment('ISSUED'), 'NOT_ALLOWED');
});

function chain(n: number): (PoApprovalEntry & { previousHash: string | null; hash: string })[] {
    const out: (PoApprovalEntry & { previousHash: string | null; hash: string })[] = [];
    let prev: string | null = null;
    for (let i = 1; i <= n; i++) {
        const e: PoApprovalEntry = { purchaseOrderId: 'po-1', seq: i, stage: `L${Math.min(i, 3)}`, action: i === 1 ? 'SUBMITTED' : 'APPROVED', actorId: `user-${i}`, amount: '1500000', remarks: null, createdAt: new Date(Date.UTC(2026, 10, i)) };
        const hash = approvalEntryHash(prev, e);
        out.push({ ...e, previousHash: prev, hash });
        prev = hash;
    }
    return out;
}

test('the approval log is tamper-evident: any changed or removed entry is found', () => {
    const good = chain(4);
    assert.equal(firstBrokenEntry(good), null);
    const edited = good.map((e) => ({ ...e }));
    edited[1].actorId = 'someone-else';
    assert.equal(firstBrokenEntry(edited), 2, 'a changed approver is detected at that entry');
    const amount = good.map((e) => ({ ...e }));
    amount[2].amount = '1';
    assert.equal(firstBrokenEntry(amount), 3);
    const removed = good.filter((e) => e.seq !== 2);
    assert.notEqual(firstBrokenEntry(removed), null, 'a removed entry breaks the links after it');
});

test('the service enforces maker-checker, distinct approvers, remarks and the step capability (source check)', () => {
    const svc = read('src/services/procurement/purchase-order.service.ts');
    assert.match(svc, /status: 'PENDING_APPROVAL',\s*\n\s*approvalStage: FIRST_PO_STAGE,\s*\n\s*createdById: userId/, 'every new order enters the chain at step 1 whatever its value');
    assert.doesNotMatch(svc, /autoApproves/, 'no order is approved on creation any more');
    assert.match(svc, /po\.createdById && po\.createdById === userId/, 'the person who raised the order cannot approve it');
    assert.match(svc, /actorId: userId, action: 'APPROVED', seq: \{ gt: passStart\?\.seq \?\? 0 \}, stage: \{ not: stage \}/, 'nobody approves two different steps in one pass; re-approving the same step after a return is allowed');
    assert.match(svc, /PO_STAGE_PERMISSION\[stage\]/, 'the step capability is checked');
    assert.match(svc, /assertRemarks\('RETURNED', remarks\)/, 'a return needs remarks');
    assert.match(svc, /approvalStage: po\.approvalStage/, 'the step is part of the claim, so two approvers cannot both take the same step');
});

test('the approval log table cannot be updated or deleted and the new columns exist (migration text)', () => {
    const sql = read('prisma/migrations/20261222000000_po_approval_chain/migration.sql');
    assert.match(sql, /CREATE TABLE "PurchaseOrderApproval"/);
    assert.match(sql, /BEFORE UPDATE OR DELETE ON "PurchaseOrderApproval"/);
    assert.match(sql, /PO_APPROVAL_IMMUTABLE/);
    assert.match(sql, /UNIQUE INDEX "PurchaseOrderApproval_purchaseOrderId_seq_key"/);
    assert.match(sql, /ADD COLUMN "financeApprovedById" UUID/);
    assert.doesNotMatch(sql, /DROP TABLE|DROP COLUMN|DELETE FROM/, 'additive only');
});

test('a supplier invoice above the threshold needs a second, different, executive approval (source check)', () => {
    const svc = read('src/services/procurement/supplier-invoice.service.ts');
    assert.match(svc, /needsExecutiveApproval\(Number\(invoice\.totalAmount\), threshold\)/);
    assert.match(svc, /status: 'AWAITING_EXECUTIVE', financeApprovedById: userId/);
    assert.match(svc, /PROCUREMENT_INVOICE_APPROVE_EXECUTIVE/);
    assert.match(svc, /financeApprovedById === userId/, 'the executive cannot be the person who gave the finance approval');
    assert.match(svc, /if \(invoice\.status === 'AWAITING_EXECUTIVE'\) \{\s*\n\s*if \(!\(await userHasPermission/, 'the executive gate follows the invoice state, so a raised threshold cannot skip it');
    assert.match(svc, /Number\.isFinite\(configured\) && configured >= 0 \? configured : DEFAULT_EXECUTIVE_PAYMENT_THRESHOLD/, 'a bad setting falls back to the default, never to no approval');
    const cfg = read('src/services/core/system-config.service.ts');
    assert.match(cfg, /PROCUREMENT_CEO_APPROVAL_THRESHOLD: map\.PROCUREMENT_CEO_APPROVAL_THRESHOLD \|\| '5000000'/, 'the default is 5 million and the admin can change it');
    assert.match(read('src/app/admin/settings/page.tsx'), /PROCUREMENT_CEO_APPROVAL_THRESHOLD/, 'it is editable in the admin settings');
});

test('the step approvers can reach the order screen and act without procurement.write (found in the browser pass)', () => {
    const pages = read('src/config/page-capabilities.ts');
    assert.match(pages, /prefix: '\/procurement\/orders', permission: RBAC_PERMISSIONS\.PROCUREMENT_READ/, 'the Finance Manager (read only) must open Order Processing to sign step 3');
    const route = read('src/app/api/procurement/purchase-orders/route.ts');
    assert.match(route, /const isStepAction = body\.action === 'APPROVE' \|\| body\.action === 'RETURN';/);
    assert.match(route, /!isStepAction && !perms\.includes\(RBAC_PERMISSIONS\.PROCUREMENT_WRITE\)/, 'raising, issuing and cancelling still need procurement.write');
    assert.match(route, /PROCUREMENT_PO_APPROVE_L3\]/, 'a step holder passes the route guard');
    const inv = read('src/app/procurement/invoices/page.tsx');
    assert.match(inv, /\['MATCHED', 'VARIANCE', 'DRAFT', 'AWAITING_EXECUTIVE'\]\.includes\(r\.status\)/, 'the CEO sees the approve button on an invoice that waits for them');
});
