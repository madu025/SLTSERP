import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../src/lib/prisma';
import { ArApService } from '../../../src/services/finance/ar-ap.service';
import { PaymentVoucherService } from '../../../src/services/finance/payment-voucher.service';
import { LedgerService } from '../../../src/services/finance/ledger.service';
import { AuditLedgerService } from '../../../src/services/inventory/audit-ledger.service';

const restorers: Array<() => void> = [];
// Prisma exposes proxy methods without ordinary property descriptors, so
// replace/restore them directly rather than using mock.method on the proxy.
function stub(target: object, key: string, implementation: unknown) {
    const original = Reflect.get(target, key);
    Reflect.set(target, key, implementation);
    restorers.push(() => { Reflect.set(target, key, original); });
}
afterEach(() => {
    while (restorers.length) restorers.pop()!();
    mock.restoreAll();
});

function receiptTransaction(options: { duplicate?: boolean; balance?: string; paid?: string; total?: string } = {}) {
    const events: string[] = [];
    let settlement: Record<string, unknown> | undefined;
    const tx = {
        $queryRaw: mock.fn(async (sql: TemplateStringsArray, ...values: unknown[]) => {
            events.push('lock');
            assert.match(sql.join('?'), /SELECT "id" FROM "ProjectInvoice".*FOR UPDATE/);
            assert.deepEqual(values, ['invoice']);
            return [{ id: 'invoice' }];
        }),
        projectInvoice: {
            findUnique: mock.fn(async () => {
                events.push('read');
                return { type: 'CLIENT', submissionStatus: 'SUBMITTED_TO_SLT',
                    balanceAmount: new Prisma.Decimal(options.balance ?? '1'),
                    paidAmount: new Prisma.Decimal(options.paid ?? '0'),
                    totalAmount: new Prisma.Decimal(options.total ?? '1') };
            }),
            update: mock.fn(async ({ data }: { data: Record<string, unknown> }) => { settlement = data; return data; }),
        },
        customerReceipt: {
            findFirst: mock.fn(async ({ where }: { where: { referenceNumber: string } }) => {
                assert.equal(where.referenceNumber, 'bank-ref');
                events.push('duplicate-check');
                return options.duplicate ? { id: 'duplicate' } : null;
            }),
            create: mock.fn(async () => ({ id: 'receipt' })),
        },
    };
    stub(prisma, '$transaction', async (fn: (client: typeof tx) => unknown) => fn(tx));
    mock.method(AuditLedgerService, 'getNextDocumentNumber', async () => 'RCT-TEST');
    mock.method(LedgerService, 'postTransaction', async () => undefined);
    return { tx, events, settlement: () => settlement };
}

test('receipt rejects nonfinite, nonpositive, excess-precision and out-of-range amounts before invoice access', async () => {
    const { events } = receiptTransaction();
    for (const amount of [NaN, Infinity, -Infinity, 0, -1, 0.001, 1_000_000_000_000]) {
        await assert.rejects(() => ArApService.recordCustomerReceipt({ invoiceId: 'invoice', amount, referenceNumber: 'bank-ref' }));
    }
    assert.deepEqual(events, []);
});

test('invoice receipt requires a nonblank bank reference', async () => {
    const { events } = receiptTransaction();
    for (const referenceNumber of [undefined, '', '   ']) {
        await assert.rejects(() => ArApService.recordCustomerReceipt({ invoiceId: 'invoice', amount: 1, referenceNumber }), /BANK_REFERENCE_REQUIRED/);
    }
    assert.deepEqual(events, []);
});

test('receipt locks before invoice read and rejects even one-cent overpayment without writes', async () => {
    const { tx, events } = receiptTransaction();
    await assert.rejects(() => ArApService.recordCustomerReceipt({ invoiceId: 'invoice', amount: 1.01, referenceNumber: 'bank-ref' }), /EXCEEDS_INVOICE_BALANCE/);
    assert.deepEqual(events, ['lock', 'read']);
    assert.equal(tx.customerReceipt.create.mock.callCount(), 0);
    assert.equal(tx.projectInvoice.update.mock.callCount(), 0);
});

test('duplicate trimmed bank reference is checked under invoice lock and rejected without writes', async () => {
    const { tx, events } = receiptTransaction({ duplicate: true });
    await assert.rejects(() => ArApService.recordCustomerReceipt({ invoiceId: 'invoice', amount: 1, referenceNumber: ' bank-ref ' }), /already exists/);
    assert.deepEqual(events, ['lock', 'read', 'duplicate-check']);
    assert.equal(tx.customerReceipt.create.mock.callCount(), 0);
    assert.equal(tx.projectInvoice.update.mock.callCount(), 0);
});

test('receipt settles fractional money using exact decimals', async () => {
    const state = receiptTransaction({ paid: '0.1', balance: '0.2', total: '0.3' });
    await ArApService.recordCustomerReceipt({ invoiceId: 'invoice', amount: 0.2, referenceNumber: ' bank-ref ' });
    assert.equal(String(state.settlement()?.paidAmount), '0.3');
    assert.equal(String(state.settlement()?.balanceAmount), '0');
    assert.equal(state.settlement()?.paymentStatus, 'PAID');
});

test('outgoing PV creation cannot target a client invoice', async () => {
    stub(prisma.projectInvoice, 'findUnique', async () => ({ type: 'CLIENT' }));
    await assert.rejects(() => PaymentVoucherService.createPaymentVoucher({ projectId: 'project', invoiceId: 'invoice', title: 'Test', payeeName: 'SLT', amount: 1 }), /CLIENT_INVOICES_REQUIRE_CUSTOMER_RECEIPTS/);
});

test('legacy approved PV cannot settle a client invoice when paid', async () => {
    const voucher = { id: 'pv', status: 'APPROVED', createdById: 'maker', invoiceId: 'invoice', projectId: 'project', amount: new Prisma.Decimal(1), type: 'CONTRACTOR', pvNumber: 'PV-TEST', payeeName: 'SLT' };
    const events: string[] = [];
    stub(prisma.paymentVoucher, 'findUnique', async () => voucher);
    const updateInvoice = mock.fn(async () => undefined);
    stub(prisma, '$transaction', async (fn: (client: unknown) => unknown) => fn({
        $queryRaw: async () => { events.push('lock'); return []; },
        paymentVoucher: { updateMany: async () => ({ count: 1 }), findUniqueOrThrow: async () => voucher },
        projectInvoice: { findUnique: async () => { events.push('read'); return { type: 'CLIENT' }; }, update: updateInvoice },
    }));
    mock.method(LedgerService, 'logPaymentVoucherPayment', async () => undefined);
    await assert.rejects(() => PaymentVoucherService.updatePaymentVoucherStatus('pv', 'PAID', 'payer'), /CLIENT_INVOICES_REQUIRE_CUSTOMER_RECEIPTS/);
    assert.deepEqual(events, ['lock', 'read']);
    assert.equal(updateInvoice.mock.callCount(), 0);
});
