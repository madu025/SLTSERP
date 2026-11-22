import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trackInvoice, type TrackerInvoice } from '../../src/lib/invoice-tracker';

const base = (over: Partial<TrackerInvoice> = {}): TrackerInvoice => ({
    status: 'PENDING', statusA: 'PENDING', statusB: 'HOLD', approvalStatus: 'DRAFT', approvalFlow: 'OSP_CHAIN', confirmStage: 'CONTRACTOR',
    contractorConfirmStatus: 'AWAITING', createdAt: '2026-11-01T00:00:00Z', ...over,
});

test('a new invoice waits for the contractor (step 2 of 8)', () => {
    const t = trackInvoice(base());
    assert.equal(t.currentKey, 'CONTRACTOR');
    assert.equal(t.stepNumber, 2);
    assert.equal(t.totalSteps, 8);
    assert.match(t.headline, /Waiting for the contractor to confirm it \(step 2 of 8\)/);
    assert.deepEqual(t.steps.map((s) => s.state), ['done', 'current', 'waiting', 'waiting', 'waiting', 'waiting', 'waiting', 'waiting']);
});

test('after the contractor it waits for the Area Manager', () => {
    const t = trackInvoice(base({ confirmStage: 'AREA_MANAGER', contractorConfirmStatus: 'CONFIRMED' }));
    assert.equal(t.currentKey, 'AREA');
    assert.match(t.headline, /the Area Manager to approve it/);
});

test('area approved: it waits at OSP Quality, then Finance sends it, then an OSP Manager, then payment', () => {
    const area = { confirmStage: 'CONFIRMED', contractorConfirmStatus: 'CONFIRMED', status: 'PENDING_SF_AUDIT' };
    assert.equal(trackInvoice(base(area)).currentKey, 'SF_AUDIT');
    const audited = { ...area, statusA: 'SF_AUDIT_APPROVED', status: 'SF_AUDIT_APPROVED' };
    assert.equal(trackInvoice(base(audited)).currentKey, 'OSP_SEND');
    const sent = { ...audited, approvalStatus: 'PENDING_OSP_APPROVAL', ospSentAt: '2026-11-10T00:00:00Z' };
    assert.equal(trackInvoice(base(sent)).currentKey, 'OSP_APPROVE');
    const approved = { ...sent, approvalStatus: 'APPROVED' };
    assert.equal(trackInvoice(base(approved)).currentKey, 'PAYMENT_REQUEST');
    assert.equal(trackInvoice(base(approved), { exists: true, createdAt: '2026-11-12T00:00:00Z' }).currentKey, 'HO_PAYMENT');
    assert.match(trackInvoice(base(approved), { exists: true, submittedToHoAt: '2026-11-13T00:00:00Z' }).headline, /Head Office to pay it/);
});

test('paid: finished, 8 of 8, the retention is still held until released', () => {
    const t = trackInvoice(base({ status: 'PAID', statusA: 'PAID', confirmStage: 'CONFIRMED', contractorConfirmStatus: 'CONFIRMED', approvalStatus: 'APPROVED' }), { exists: true, paid: true, hoPaidDate: '2026-11-20T00:00:00Z' });
    assert.equal(t.finished, true);
    assert.equal(t.headline, 'Paid');
    assert.equal(t.currentKey, null);
    assert.ok(t.steps.every((s) => s.state === 'done'));
    assert.equal(t.retentionHeld, true);
    assert.equal(trackInvoice(base({ status: 'PAID', statusA: 'PAID', statusB: 'PAID', confirmStage: 'CONFIRMED' }), { exists: true, paid: true }).retentionHeld, false);
});

test('a cancelled invoice says so and shows what was never reached', () => {
    const t = trackInvoice(base({ status: 'CANCELLED', confirmStage: 'CANCELLED' }));
    assert.equal(t.cancelled, true);
    assert.equal(t.headline, 'Cancelled');
    assert.equal(t.currentKey, null);
    assert.ok(t.steps.slice(1).every((s) => s.state === 'cancelled' || s.state === 'done'));
});

test('an invoice an OSP Manager returned shows the reason at the Finance step', () => {
    const t = trackInvoice(base({ confirmStage: 'CONFIRMED', contractorConfirmStatus: 'CONFIRMED', statusA: 'SF_AUDIT_APPROVED', status: 'SF_AUDIT_APPROVED', approvalStatus: 'DRAFT', ospNote: 'amount differs' }));
    assert.equal(t.currentKey, 'OSP_SEND');
    assert.match(t.steps.find((s) => s.key === 'OSP_SEND')!.note ?? '', /Returned by an OSP Manager: amount differs/);
});

test('an older invoice runs the shorter chain: created, area, finance, paid', () => {
    const t = trackInvoice(base({ approvalFlow: 'LEGACY', confirmStage: 'CONFIRMED' }));
    assert.equal(t.flow, 'LEGACY');
    assert.equal(t.totalSteps, 4);
    assert.equal(t.currentKey, 'FINANCE_APPROVAL');
    assert.equal(trackInvoice(base({ approvalFlow: 'LEGACY', confirmStage: 'CONFIRMED', approvalStatus: 'APPROVED' })).currentKey, 'HO_PAYMENT');
});

test('a contractor who disputed is shown the note at the contractor step', () => {
    const t = trackInvoice(base({ contractorConfirmStatus: 'DISPUTED', contractorNote: 'wrong quantity' }));
    assert.equal(t.steps[1].note, 'wrong quantity');
});
