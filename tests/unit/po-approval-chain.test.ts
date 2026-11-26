import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PO_HISTORY_STAGE_LABEL } from '../../src/lib/po-approval-chain';
import { approvalEntryHash, firstBrokenEntry, type PoApprovalEntry } from '../../src/lib/po-approval-hash';
import { RBAC_PERMISSION_DEFINITIONS } from '../../src/config/rbac-permissions';

/**
 * Purchase orders are approved in the HO system (owner, 26 Nov 2026): the CEO's approval of large payments and the three-step PO chain in
 * Nexus were removed. Nexus records the approved order with its payment terms and keeps every event in a tamper-evident log.
 */
const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('no PO approval step and no CEO approval is left in the code or the capability catalog', () => {
    const codes = RBAC_PERMISSION_DEFINITIONS.map((p) => p.code);
    for (const c of ['procurement.po.approve.l1', 'procurement.po.approve.l2', 'procurement.po.approve.l3', 'procurement.invoice.approve.executive']) {
        assert.ok(!codes.includes(c as never), `${c} is gone from the catalog`);
    }
    const svc = read('src/services/procurement/purchase-order.service.ts');
    assert.doesNotMatch(svc, /approveStorePo|returnStorePo|resubmitStorePo|approvalMode\(/);
    assert.match(svc, /status: 'APPROVED',\s*\n\s*approvalStage: null,\s*\n\s*createdById: userId,/, 'an order is recorded as approved (approved in the HO system); the person who recorded it is kept');
    assert.match(svc, /action: 'RECORDED'/, 'the log says the approval came from the HO system');
    const route = read('src/app/api/procurement/purchase-orders/route.ts');
    assert.doesNotMatch(route, /'APPROVE'|'RETURN'|'RESUBMIT'|meta=mode/);
    assert.match(route, /permissions: \[RBAC_PERMISSIONS\.PROCUREMENT_WRITE\]/);
    const inv = read('src/services/procurement/supplier-invoice.service.ts');
    assert.doesNotMatch(inv, /AWAITING_EXECUTIVE|needsExecutiveApproval|EXECUTIVE_THRESHOLD/);
    const settings = read('src/app/admin/settings/page.tsx');
    assert.doesNotMatch(settings, /PROCUREMENT_CEO_APPROVAL_THRESHOLD|PROCUREMENT_PO_APPROVAL_MODE/);
    assert.doesNotMatch(read('src/app/procurement/orders/page.tsx'), /data-testid="po-approve"|data-testid="po-return"|data-testid="po-resubmit"/);
});

test('the vendor or value of an order approved in the HO system is not changed in Nexus (source check)', () => {
    const svc = read('src/services/procurement/purchase-order.service.ts');
    assert.match(svc, /if \(valueChanged\) \{\s*\n\s*throw AppError\.badRequest\('This order was approved in the HO system/);
});

test('the logs of orders approved by the former chain still read with their step names', () => {
    assert.equal(PO_HISTORY_STAGE_LABEL.L1, 'Step 1: OSP Manager');
    assert.equal(PO_HISTORY_STAGE_LABEL.L3, 'Step 3: Finance Manager (HO)');
});

function chain(n: number): (PoApprovalEntry & { previousHash: string | null; hash: string })[] {
    const out: (PoApprovalEntry & { previousHash: string | null; hash: string })[] = [];
    let prev: string | null = null;
    for (let i = 1; i <= n; i++) {
        const e: PoApprovalEntry = { purchaseOrderId: 'po-1', seq: i, stage: null, action: i === 1 ? 'RECORDED' : 'CANCELLED', actorId: `user-${i}`, amount: '1500000', remarks: null, createdAt: new Date(Date.UTC(2026, 10, i)) };
        const hash = approvalEntryHash(prev, e);
        out.push({ ...e, previousHash: prev, hash });
        prev = hash;
    }
    return out;
}

test('the order log is tamper-evident: any changed or removed entry is found', () => {
    const good = chain(4);
    assert.equal(firstBrokenEntry(good), null);
    const edited = good.map((e) => ({ ...e }));
    edited[1].actorId = 'someone-else';
    assert.equal(firstBrokenEntry(edited), 2, 'a changed actor is detected at that entry');
    const amount = good.map((e) => ({ ...e }));
    amount[2].amount = '1';
    assert.equal(firstBrokenEntry(amount), 3);
    const removed = good.filter((e) => e.seq !== 2);
    assert.notEqual(firstBrokenEntry(removed), null, 'a removed entry breaks the links after it');
});

test('the order log table cannot be updated or deleted (migration text)', () => {
    const sql = read('prisma/migrations/20261222000000_po_approval_chain/migration.sql');
    assert.match(sql, /CREATE TABLE "PurchaseOrderApproval"/);
    assert.match(sql, /BEFORE UPDATE OR DELETE ON "PurchaseOrderApproval"/);
    assert.match(sql, /PO_APPROVAL_IMMUTABLE/);
    assert.match(sql, /UNIQUE INDEX "PurchaseOrderApproval_purchaseOrderId_seq_key"/);
});

test('Order Processing stays open to the procurement readers (page capability)', () => {
    assert.match(read('src/config/page-capabilities.ts'), /prefix: '\/procurement\/orders', permission: RBAC_PERMISSIONS\.PROCUREMENT_READ/);
});
