import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyInvoiceTransition } from '../../../src/services/project/project-invoice-lifecycle';

const baseInvoice = {
  status: 'ISSUED',
  submissionStatus: 'NOT_SUBMITTED',
  paymentStatus: 'NOT_DUE',
  totalAmount: 1000,
  paidAmount: 0,
  balanceAmount: 1000,
  dueDate: new Date('2030-01-10T00:00:00.000Z'),
  createdById: 'maker-id',
};

describe('Project invoice lifecycle', () => {
  it('keeps SLT submission and payment pending as separate facts', () => {
    const result = applyInvoiceTransition(baseInvoice, {
      transition: 'SUBMIT_TO_SLT',
      actorUserId: 'finance-manager-id',
      submissionReference: 'SLT-INV-001',
      now: new Date('2030-01-01T00:00:00.000Z'),
    });

    assert.equal(result.data.submissionStatus, 'SUBMITTED_TO_SLT');
    assert.equal(result.data.paymentStatus, 'PENDING');
    assert.equal(result.data.submissionReference, 'SLT-INV-001');
  });

  it('does not allow a receipt workflow to be skipped by completing an unpaid invoice', () => {
    assert.throws(
      () => applyInvoiceTransition(baseInvoice, {
        transition: 'COMPLETED',
        actorUserId: 'finance-manager-id',
      }),
      /INVOICE_MUST_BE_FULLY_PAID_BEFORE_COMPLETION/,
    );
  });

  it('allows completion only after the payment dimension is paid', () => {
    const result = applyInvoiceTransition({
      ...baseInvoice,
      status: 'PAID',
      submissionStatus: 'SUBMITTED_TO_SLT',
      paymentStatus: 'PAID',
      paidAmount: 1000,
      balanceAmount: 0,
    }, {
      transition: 'COMPLETED',
      actorUserId: 'finance-manager-id',
      now: new Date('2030-01-11T00:00:00.000Z'),
    });

    assert.equal(result.data.status, 'COMPLETED');
  });

  it('rejects cancellation after external submission', () => {
    assert.throws(
      () => applyInvoiceTransition({ ...baseInvoice, submissionStatus: 'SUBMITTED_TO_SLT', paymentStatus: 'PENDING' }, {
        transition: 'CANCELLED',
        actorUserId: 'finance-manager-id',
      }),
      /SUBMITTED_OR_PAID_INVOICES_REQUIRE_A_CREDIT_NOTE/,
    );
  });

  it('rejects inconsistent paid flags and missing submission on completion', () => {
    for (const overrides of [
      { paymentStatus: 'PAID', balanceAmount: 100 },
      { paymentStatus: 'PENDING', balanceAmount: 0 },
      { submissionStatus: 'NOT_SUBMITTED', paymentStatus: 'PAID', balanceAmount: 0 },
    ]) {
      assert.throws(() => applyInvoiceTransition({ ...baseInvoice, status: 'PAID', paidAmount: 1000, ...overrides }, {
        transition: 'COMPLETED', actorUserId: 'approver',
      }), /INVOICE_MUST_BE_FULLY_PAID_BEFORE_COMPLETION/);
    }
  });
});
