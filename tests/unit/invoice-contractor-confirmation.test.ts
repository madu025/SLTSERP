import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { isReadyForOspQuality, planContractorConfirmation } from '../../src/lib/invoice-contractor-confirm-rules';

test('the contractor can confirm or dispute an invoice that is waiting for it', () => {
    assert.deepEqual(planContractorConfirmation({ state: 'AWAITING', action: 'CONFIRM', isOwnInvoice: true }), { ok: true, next: 'CONFIRMED' });
    assert.deepEqual(planContractorConfirmation({ state: 'AWAITING', action: 'DISPUTE', isOwnInvoice: true, note: 'Wrong rate on three orders' }), { ok: true, next: 'DISPUTED' });
});

test('a dispute needs a reason', () => {
    for (const note of [undefined, '', '  ', 'no']) {
        const r = planContractorConfirmation({ state: 'AWAITING', action: 'DISPUTE', isOwnInvoice: true, note });
        assert.equal(!r.ok && r.reason, 'REASON_REQUIRED', String(note));
    }
});

test('a contractor cannot answer another contractor\'s invoice, or answer twice', () => {
    const other = planContractorConfirmation({ state: 'AWAITING', action: 'CONFIRM', isOwnInvoice: false });
    assert.equal(!other.ok && other.reason, 'NOT_OWN_INVOICE');
    for (const state of ['CONFIRMED', 'DISPUTED']) {
        const r = planContractorConfirmation({ state, action: 'CONFIRM', isOwnInvoice: true });
        assert.equal(!r.ok && r.reason, 'NOT_AWAITING', state);
    }
});

test('only a disputed invoice goes back to the contractor, and it waits for the contractor again', () => {
    assert.deepEqual(planContractorConfirmation({ state: 'DISPUTED', action: 'RESEND', isOwnInvoice: false }), { ok: true, next: 'AWAITING' });
    for (const state of ['AWAITING', 'CONFIRMED']) {
        const r = planContractorConfirmation({ state, action: 'RESEND', isOwnInvoice: false });
        assert.equal(!r.ok && r.reason, 'NOT_DISPUTED', state);
    }
});

test('an invoice reaches OSP Quality only after the area chain and the contractor both confirmed it', () => {
    const ok = { confirmStage: 'CONFIRMED', contractorConfirmStatus: 'CONFIRMED', statusA: 'PENDING_SF_AUDIT' };
    assert.equal(isReadyForOspQuality(ok), true);
    assert.equal(isReadyForOspQuality({ ...ok, contractorConfirmStatus: 'AWAITING' }), false);
    assert.equal(isReadyForOspQuality({ ...ok, contractorConfirmStatus: 'DISPUTED' }), false);
    assert.equal(isReadyForOspQuality({ ...ok, confirmStage: 'QC_OFFICER' }), false);
    assert.equal(isReadyForOspQuality({ ...ok, statusA: 'SF_AUDIT_APPROVED' }), false);
});

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../..', p), 'utf8');

test('wiring: new invoices wait for the contractor, and neither SF Audit clearance path skips that step', () => {
    assert.ok(read('src/services/invoice/invoice.generator.service.ts').includes("contractorConfirmStatus: 'AWAITING'"));
    assert.ok(read('src/services/invoice/invoice.service.ts').includes("invoice.contractorConfirmStatus !== 'CONFIRMED'"));
    assert.ok(read('src/services/finance/invoice.service.ts').includes("invoice.contractorConfirmStatus !== 'CONFIRMED'"));
    const svc = read('src/services/invoice/invoice-contractor-confirmation.service.ts');
    assert.ok(svc.includes("where: { id: invoice.id, contractorConfirmStatus: 'AWAITING' }"), 'answering is a conditional update, so it can only win once');
    assert.ok(svc.includes('user.contractorId'), 'identity is the signed-in contractor');
    assert.ok(read('src/app/api/contractor-portal/invoices/[id]/respond/route.ts').includes('CONTRACTOR_WRITE'));
    assert.ok(read('src/app/api/finance/sf-audit/queue/route.ts').includes('FINANCE_AUDIT'));
    const m = read('prisma/migrations/20261205000000_invoice_contractor_confirmation/migration.sql');
    assert.ok(m.includes('"contractorConfirmStatus" TEXT NOT NULL DEFAULT \'CONFIRMED\''), 'older invoices stay confirmed');
});

after(() => { setTimeout(() => process.exit(process.exitCode ?? 0), 100).unref?.(); });
