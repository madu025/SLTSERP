import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { isLateSod, completedMonthLabel, sodStageLabel, SOD_READY_STAGES, SOD_GATE } from '../../src/lib/sod-approval-rules';
import { monthRange } from '../../src/services/service-order/sod-approval.service';
import { planApproval } from '../../src/lib/approval-chain-rules';

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../..', p), 'utf8');

test('an order completed before the billing month is a late SOD, also across a year end', () => {
    assert.equal(isLateSod('2026-06-15T10:00:00', 6, 2026), false, 'completed in the billing month');
    assert.equal(isLateSod('2026-05-31T23:00:00', 6, 2026), true, 'completed in the month before');
    assert.equal(isLateSod('2025-12-20T10:00:00', 1, 2026), true, 'December billed in January');
    assert.equal(isLateSod('2026-01-02T10:00:00', 1, 2026), false);
    assert.equal(isLateSod('2026-07-01T00:00:00', 6, 2026), false, 'a later month is not late (it cannot be invoiced yet)');
    assert.equal(isLateSod(null, 6, 2026), false);
    assert.equal(completedMonthLabel('2026-06-15T10:00:00'), 'June 2026');
});

test('the order stages are worded for the people who act on them', () => {
    assert.deepEqual([...SOD_READY_STAGES], ['READY', 'CONFIRMED']);
    assert.equal(sodStageLabel(null), 'Not started');
    assert.equal(sodStageLabel('READY'), 'Ready for the engineer');
    assert.equal(sodStageLabel('CONFIRMED'), 'Ready for the engineer');
    assert.equal(sodStageLabel('AREA_COORDINATOR'), 'Area Coordinator');
    assert.equal(sodStageLabel('IN_GATE'), 'Starting approval');
    assert.deepEqual(SOD_GATE, { entityType: 'SERVICE_ORDER', fromStatus: 'COMPLETED', toStatus: 'READY_FOR_INVOICE' });
});

test('a completed month is a half-open range', () => {
    const r = monthRange(12, 2026);
    assert.equal(r.gte.getFullYear(), 2026); assert.equal(r.gte.getMonth(), 11);
    assert.equal(r.lt.getFullYear(), 2027); assert.equal(r.lt.getMonth(), 0);
});

test('wiring: the engineer invoices by contractor and area, the invoice carries its area, and the old page leads to the new one', () => {
    const svc = read('src/services/invoice/invoicing.service.ts');
    assert.ok(svc.includes("`${o.contractorId}:${o.opmcId}`"), 'one group, and so one invoice, per contractor and area');
    assert.ok(svc.includes('allowLate: true') && svc.includes('invoicingHeldAt: null'), 'late orders are billed, held-back orders are not');
    assert.ok(svc.includes('verifyInvoicable') && svc.includes('lenient: true'), 'the financial check runs first and does not stop the other orders');
    assert.ok(svc.includes('InvoiceGateService.startFor'), 'each invoice starts its approval');
    const route = read('src/app/api/invoicing/route.ts');
    assert.ok(route.includes('RBAC_PERMISSIONS.SOD_INVOICE') && route.includes("'CREATE'") && route.includes("'HOLD'") && route.includes("'RETURN'"));
    assert.ok(read('src/app/service-orders/invoicable/page.tsx').includes("redirect('/service-orders/invoicing')"));
    assert.ok(read('src/config/page-capabilities.ts').includes("'/service-orders/invoicing'") && read('src/config/page-capabilities.ts').includes("'/service-orders/approvals'"));
    assert.ok(read('src/lib/invoice-access.ts').includes('invoiceAreaOf') && read('src/services/approval/process-gate-engine.ts').includes('invoice?.opmcId'), 'the invoice area decides who sees it and who approves it');
});

test('the approval messages name what is approved, and one person cannot pass two steps', () => {
    const base = { stageLabel: 'QC Officer', userId: 'u1', canAct: true, inScope: true, history: [] as Array<{ userId: string; stage: string; action: string }> };
    assert.equal((planApproval({ ...base, waiting: false, noun: 'order' }) as { message: string }).message, 'This order is not waiting for an approval');
    assert.equal((planApproval({ ...base, waiting: false }) as { message: string }).message, 'This invoice is not waiting for an approval');
    assert.equal((planApproval({ ...base, waiting: true, inScope: false, noun: 'order' }) as { message: string }).message, 'This order is outside your area');
    const twice = planApproval({ ...base, waiting: true, noun: 'order', history: [{ userId: 'u1', stage: 'AREA_COORDINATOR', action: 'CONFIRMED' }] });
    assert.equal(twice.ok, false);
    assert.equal(planApproval({ ...base, waiting: true, history: [{ userId: 'u2', stage: 'AREA_COORDINATOR', action: 'CONFIRMED' }] }).ok, true);
});

test('wiring: a rejection or a dispute sends the invoice back to the Engineer, and a re-issue has its own key', () => {
    const gate = read('src/services/invoice/invoice-gate.service.ts');
    assert.ok(gate.includes('this.takeOut(userId, inv.id, null,') && gate.includes("'RETURNED_TO_ENGINEER'"), 'returning an invoice takes every order out');
    assert.ok(gate.includes('invoicingHeldAt: new Date(), invoicingHoldReason'), 'taken-out orders are held back with the reason, ready for the Engineer');
    const gen = read('src/services/invoice/invoice.generator.service.ts');
    assert.ok(gen.includes('reissueKey') && gen.includes('startsWith: baseKey'), 'the same orders can be invoiced again after a cancelled invoice');
});

after(() => { setTimeout(() => process.exit(process.exitCode ?? 0), 100).unref?.(); });
