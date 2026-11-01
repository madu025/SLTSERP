import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { Prisma } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import { BillingService } from '../../src/services/finance/billing.service';
import { InvoiceApprovalService } from '../../src/services/finance/invoice-approval.service';
import { PaymentVoucherService } from '../../src/services/finance/payment-voucher.service';
import { BankCashService } from '../../src/services/finance/bank-cash.service';
import { InvoiceGeneratorService } from '../../src/services/invoice/invoice.generator.service';
import { LedgerService } from '../../src/services/finance/ledger.service';

/* eslint-disable @typescript-eslint/no-explicit-any -- deterministic transactional QA adapter. */
const restorers: Array<() => void> = [];
function stub(target: object, key: string, implementation: unknown) {
  const original = Reflect.get(target, key);
  Reflect.set(target, key, implementation);
  restorers.push(() => Reflect.set(target, key, original));
}

afterEach(() => {
  while (restorers.length) restorers.pop()!();
  mock.restoreAll();
});

test('contractor billing to payment voucher, bank reconciliation, and GL completes 10 batches', async () => {
  let activeBatch = 0;
  const invoices = new Map<string, any>();
  const vouchers = new Map<string, any>();
  const statementLines = new Map<string, any>();
  const journalLines = new Map<string, any>();
  const ledgerEvents: string[] = [];

  const tx = {
    invoice: {
      findUnique: async ({ where }: any) => invoices.get(where.id) || null,
      update: async ({ where, data }: any) => {
        const invoice = invoices.get(where.id);
        Object.assign(invoice, data);
        return invoice;
      },
    },
    paymentVoucher: {
      updateMany: async ({ where, data }: any) => {
        const voucher = vouchers.get(where.id);
        if (!voucher || voucher.status !== where.status) return { count: 0 };
        Object.assign(voucher, data);
        return { count: 1 };
      },
      findUniqueOrThrow: async ({ where }: any) => vouchers.get(where.id),
    },
    bankStatementLine: {
      findUnique: async ({ where }: any) => {
        const line = statementLines.get(where.id);
        return line ? { ...line, bankAccount: { glAccountCode: 'BANK-1000' } } : null;
      },
      findFirst: async ({ where }: any) => [...statementLines.values()].find((line) => line.reconciledJournalLineId === where.reconciledJournalLineId) || null,
      update: async ({ where, data }: any) => {
        const line = statementLines.get(where.id);
        Object.assign(line, data);
        return line;
      },
    },
    journalLine: {
      findUnique: async ({ where }: any) => journalLines.get(where.id) || null,
    },
    $queryRaw: async () => [],
  };

  stub(prisma, '$transaction', async (callback: (client: typeof tx) => unknown) => callback(tx));
  stub(prisma.user, 'findUnique', async () => ({
    permissions: JSON.stringify(['admin.rbac']),
    accessibleOpmcs: [],
    systemRole: null,
    sectionAssignments: [],
  }));
  stub(prisma.project, 'findUnique', async () => ({ id: 'project-1', opmcId: 'opmc-1' }));
  stub(prisma.invoice, 'findUnique', async ({ where }: any) => invoices.get(where.id) || null);
  stub(prisma.paymentVoucher, 'count', async () => activeBatch);
  stub(prisma.paymentVoucher, 'findUnique', async ({ where }: any) => vouchers.get(where.id) || null);
  stub(prisma.paymentVoucher, 'create', async ({ data }: any) => {
    const voucher = { id: `pv-${activeBatch}`, ...data };
    vouchers.set(voucher.id, voucher);
    return voucher;
  });
  stub(prisma.contractor, 'findUnique', async () => ({ kycVerified: true, whtHoldStatus: false }));
  stub(prisma.bankAccount, 'findUnique', async () => ({ id: `bank-${activeBatch}`, openingBalance: 0, glAccountCode: 'BANK-1000' }));
  stub(prisma.bankStatementLine, 'findMany', async () => [...statementLines.values()]);
  stub(prisma.journalLine, 'findMany', async () => [...journalLines.values()]);

  mock.method(InvoiceGeneratorService, 'generateContractorMonthlyInvoice', async (data: any) => {
    const invoice = {
      id: `invoice-${activeBatch}`,
      invoiceNumber: `QA-INV-${String(activeBatch).padStart(3, '0')}`,
      projectId: 'project-1',
      contractorId: data.contractorId,
      totalAmount: new Prisma.Decimal(1000),
      status: 'PENDING_SF_AUDIT',
      approvalStatus: 'PENDING',
    };
    invoices.set(invoice.id, invoice);
    return {
      invoice,
      sods: [],
      totalGrossAmount: 1000,
      publicUrl: '',
    };
  });
  mock.method(LedgerService, 'logPaymentVoucherPayment', async () => {
    ledgerEvents.push(`PV_PAID_${activeBatch}`);
  });

  for (activeBatch = 1; activeBatch <= 10; activeBatch += 1) {
    const billing = await BillingService.generateContractorInvoice({
      contractorId: 'contractor-qa',
      retentionPercent: 5,
      whtPercent: 5,
      month: 10,
      year: 2026,
    }, 'maker-qa');
    const invoice = billing.invoice;
    assert.equal(invoice.status, 'PENDING_SF_AUDIT');

    const approvedInvoice = await InvoiceApprovalService.approveInvoice(invoice.id, 'checker-qa');
    assert.equal(approvedInvoice.approvalStatus, 'APPROVED');

    const voucher = await PaymentVoucherService.createPaymentVoucher({
      projectId: 'project-1',
      contractorInvoiceId: invoice.id,
      title: `QA contractor settlement ${activeBatch}`,
      payeeName: 'QA Contractor',
      payeeId: 'contractor-qa',
      amount: 1000,
      type: 'CONTRACTOR',
      createdById: 'maker-qa',
      paymentMethod: 'BANK_TRANSFER',
    });
    assert.equal(voucher.status, 'DRAFT');

    const pending = await PaymentVoucherService.updatePaymentVoucherStatus(voucher.id, 'PENDING_APPROVAL', 'maker-qa');
    assert.equal(pending.status, 'PENDING_APPROVAL');
    const approved = await PaymentVoucherService.updatePaymentVoucherStatus(voucher.id, 'APPROVED', 'checker-qa');
    assert.equal(approved.status, 'APPROVED');
    const paid = await PaymentVoucherService.updatePaymentVoucherStatus(voucher.id, 'PAID', 'checker-qa');
    assert.equal(paid.status, 'PAID');

    const statementId = `statement-${activeBatch}`;
    const journalId = `journal-${activeBatch}`;
    statementLines.set(statementId, {
      id: statementId,
      debit: new Prisma.Decimal(0),
      credit: new Prisma.Decimal(1000),
      isReconciled: false,
      reconciledJournalLineId: null,
    });
    journalLines.set(journalId, {
      id: journalId,
      accountCode: 'BANK-1000',
      debit: new Prisma.Decimal(0),
      credit: new Prisma.Decimal(1000),
      entry: { status: 'POSTED' },
    });
    const reconciled = await BankCashService.reconcileStatementLine(statementId, journalId);
    assert.equal(reconciled.isReconciled, true);

    const summary = await BankCashService.getBankReconciliationSummary(`bank-${activeBatch}` as any);
    assert.equal(summary.isReconciled, true);
    assert.equal(summary.unreconciledStatementCount, 0);
  }

  assert.equal(ledgerEvents.length, 10);
  assert.deepEqual(ledgerEvents, Array.from({ length: 10 }, (_, index) => `PV_PAID_${index + 1}`));
});

