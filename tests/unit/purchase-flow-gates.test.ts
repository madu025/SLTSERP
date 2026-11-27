import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { requestGate, approvalGate, approvalSodBlocked, docsGate, poGate, fullyOrdered, voucherGate, signaturesGate, hoPaymentGate, purchaseStation, firstFailure, isWholeUnit } from '../../src/lib/purchase-flow-gates';

const keys = (c: Array<{ key: string; ok: boolean }>) => c.filter((x) => !x.ok).map((x) => x.key);

test('1 material request: store, item, no duplicates, positive (whole for Nos), date not past, purpose', () => {
    const ok = { storeChosen: true, purpose: 'FTTH new connections', requiredDate: '2026-11-28', today: '2026-11-27', lines: [{ key: 'a', name: 'C-Hook', unit: 'Nos', quantity: 1000 }] };
    assert.deepEqual(keys(requestGate(ok)), []);
    assert.deepEqual(keys(requestGate({ ...ok, storeChosen: false })), ['store']);
    assert.deepEqual(keys(requestGate({ ...ok, lines: [] })), ['items']);
    assert.deepEqual(keys(requestGate({ ...ok, lines: [...ok.lines, { ...ok.lines[0] }] })), ['duplicate']);
    assert.deepEqual(keys(requestGate({ ...ok, lines: [{ ...ok.lines[0], quantity: 2.5 }] })), ['quantity'], 'whole numbers for Nos');
    assert.deepEqual(keys(requestGate({ ...ok, lines: [{ ...ok.lines[0], unit: 'm', quantity: 2.5 }] })), [], 'metres may be fractional');
    assert.deepEqual(keys(requestGate({ ...ok, requiredDate: '2026-11-26' })), ['date']);
    assert.deepEqual(keys(requestGate({ ...ok, purpose: ' ' })), ['purpose']);
    assert.equal(isWholeUnit('NOS'), true);
    assert.equal(firstFailure(requestGate({ ...ok, purpose: '' }))?.key, 'purpose');
});

test('2-3 approvals: SoD (requester, earlier signer), quantities within the request, a reason when reducing or rejecting', () => {
    const ok = { actorId: 'sm', requesterId: 'so', earlierSignerIds: [], waitingHere: true, rejecting: false, reason: '', lines: [{ name: 'C-Hook', requested: 1000, approved: 1000 }] };
    assert.deepEqual(keys(approvalGate(ok)), []);
    assert.deepEqual(keys(approvalGate({ ...ok, actorId: 'so' })), ['sod']);
    assert.equal(approvalSodBlocked({ actorId: 'sm', requesterId: 'so', earlierSignerIds: ['sm'] }), 'earlier');
    assert.equal(approvalSodBlocked({ actorId: 'so', requesterId: 'so', earlierSignerIds: [], isAdmin: true }), null);
    assert.deepEqual(keys(approvalGate({ ...ok, lines: [{ name: 'C-Hook', requested: 1000, approved: 1001 }] })), ['approved']);
    assert.deepEqual(keys(approvalGate({ ...ok, lines: [{ name: 'C-Hook', requested: 1000, approved: 800 }] })), ['reason']);
    assert.deepEqual(keys(approvalGate({ ...ok, rejecting: true })), ['reason']);
    assert.deepEqual(keys(approvalGate({ ...ok, waitingHere: false })), ['stage']);
});

test('4-5 documents and purchase order: docs first, vendor, within what is open, price, terms; fully ordered moves on', () => {
    assert.deepEqual(keys(docsGate({ approved: true, alreadySubmitted: false })), []);
    assert.deepEqual(keys(docsGate({ approved: true, alreadySubmitted: true })), ['once']);
    const ok = { docsIn: true, vendorChosen: true, lines: [{ name: 'C-Hook', open: 1000, quantity: 600, unitPrice: 150 }], basis: 'CREDIT', creditDays: 30, dueDate: null };
    assert.deepEqual(keys(poGate(ok)), []);
    assert.deepEqual(keys(poGate({ ...ok, docsIn: false })), ['docs']);
    assert.deepEqual(keys(poGate({ ...ok, lines: [{ ...ok.lines[0], quantity: 1001 }] })), ['open']);
    assert.deepEqual(keys(poGate({ ...ok, lines: [{ ...ok.lines[0], unitPrice: 0 }] })), ['price']);
    assert.deepEqual(keys(poGate({ ...ok, creditDays: null })), ['terms']);
    assert.equal(fullyOrdered([{ approved: 1000, ordered: 600 }]), false);
    assert.equal(fullyOrdered([{ approved: 1000, ordered: 1000 }]), true);
});

test('7-10 voucher, signatures, HO payments', () => {
    assert.deepEqual(keys(voucherGate({ invoiceApprovedOrMatched: true, hasVoucher: false, amount: 82500, invoiceTotal: 82500 })), []);
    assert.deepEqual(keys(voucherGate({ invoiceApprovedOrMatched: true, hasVoucher: false, amount: 80000, invoiceTotal: 82500 })), ['amount']);
    assert.deepEqual(keys(signaturesGate({ scanAttached: true, invoiceMatches: true })), [], 'the Account Officer who raised the voucher records the paper signatures');
    assert.deepEqual(keys(signaturesGate({ scanAttached: false, invoiceMatches: false })), ['scan', 'match']);
    const pay = { amount: 50000, balance: 82500, reference: 'TT-0001', paidDate: '2026-11-27', today: '2026-11-27', withHo: true };
    assert.deepEqual(keys(hoPaymentGate(pay)), []);
    assert.deepEqual(keys(hoPaymentGate({ ...pay, amount: 90000 })), ['amount']);
    assert.deepEqual(keys(hoPaymentGate({ ...pay, reference: 'x' })), ['reference']);
    assert.deepEqual(keys(hoPaymentGate({ ...pay, paidDate: '2026-11-28' })), ['date']);
});

test('the route station of a request', () => {
    assert.equal(purchaseStation({ status: 'PENDING', workflowStage: 'STORES_MANAGER_APPROVAL' }), 'STORES_MANAGER');
    assert.equal(purchaseStation({ status: 'PENDING', workflowStage: 'OSP_MANAGER_APPROVAL' }), 'OSP_MANAGER');
    assert.equal(purchaseStation({ status: 'APPROVED', workflowStage: 'PROCUREMENT' }), 'DOCUMENTS');
    assert.equal(purchaseStation({ status: 'APPROVED', workflowStage: 'PROCUREMENT', procurementDocsSubmittedAt: '2026-11-27' }), 'PO');
    assert.equal(purchaseStation({ status: 'APPROVED', workflowStage: 'GRN_PENDING' }), 'GRN');
    assert.equal(purchaseStation({ status: 'REJECTED', workflowStage: 'REJECTED' }), 'CLOSED');
});

test('the services throw the same rules the screens show', () => {
    const svc = readFileSync(new URL('../../src/services/inventory/stock-request.service.ts', import.meta.url), 'utf8');
    assert.match(svc, /firstFailure\(requestGate\(\{/);
    assert.match(svc, /approvalSodBlocked\(\{ actorId: userId, requesterId: stockReq\.requestedById/);
    assert.match(readFileSync(new URL('../../src/services/procurement/purchase-order.service.ts', import.meta.url), 'utf8'), /firstFailure\(poGate\(\{/);
    const po = readFileSync(new URL('../../src/app/procurement/orders/page.tsx', import.meta.url), 'utf8');
    assert.match(po, /const poChecks = selectedRequest \? poGate\(\{/);
    assert.match(readFileSync(new URL('../../src/app/inventory/requests/page.tsx', import.meta.url), 'utf8'), /docsGate\(\{ approved:/);
});

test('a material request shows no estimated price (owner, 27 Nov 2026: an estimate from the item master can mislead)', () => {
    for (const f of ['src/app/inventory/requests/page.tsx', 'src/app/procurement/approvals/page.tsx', 'src/app/inventory/requests/create/page.tsx']) {
        const src = readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');
        assert.doesNotMatch(src, /Est\. (Total Value|Cost)|estimatedCost|Est\. PO Value/, f);
    }
});

test('the voucher and HO payment steps use the same gates on the screen and in the service', () => {
    const r = (f: string) => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');
    assert.match(r('src/services/finance/payment-voucher.service.ts'), /firstFailure\(voucherGate\(\{/);
    assert.match(r('src/services/procurement/ho-payment.service.ts'), /firstFailure\(hoPaymentGate\(\{/);
    const hop = r('src/app/finance/ho-payments/page.tsx');
    assert.match(hop, /voucherGate\(\{/);
    assert.match(hop, /hoPaymentGate\(\{/);
    const pva = r('src/app/procurement/payment-approvals/page.tsx');
    assert.match(pva, /signaturesGate\(\{ scanAttached: !!file/);
    assert.match(pva, /docsChainGate\(\{/);
    assert.doesNotMatch(pva, /window\.(confirm|prompt)\(/, 'no browser dialogs: the panel shows the checks');
});

