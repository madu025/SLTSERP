import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isInvoiceOpenForClosure, type ClosureInvoice } from '../../src/services/project/project-closure';

const paidClient: ClosureInvoice = {
    type: 'CLIENT', status: 'PAID', submissionStatus: 'SUBMITTED_TO_SLT',
    paymentStatus: 'PAID', totalAmount: 100, paidAmount: 100, balanceAmount: 0,
};

describe('project closure invoice gate', () => {
    it('accepts a submitted and fully settled client invoice', () => {
        assert.equal(isInvoiceOpenForClosure(paidClient), false);
    });

    it('rejects submission without payment and payment without submission', () => {
        assert.equal(isInvoiceOpenForClosure({ ...paidClient, paymentStatus: 'PENDING', paidAmount: 0, balanceAmount: 100 }), true);
        assert.equal(isInvoiceOpenForClosure({ ...paidClient, submissionStatus: 'NOT_SUBMITTED' }), true);
    });

    it('rejects stale payment labels when the balance is still open', () => {
        assert.equal(isInvoiceOpenForClosure({ ...paidClient, balanceAmount: 1 }), true);
    });

    it('accepts settled contractor invoices and excludes cancelled invoices', () => {
        assert.equal(isInvoiceOpenForClosure({ ...paidClient, type: 'CONTRACTOR', submissionStatus: 'NOT_SUBMITTED' }), false);
        assert.equal(isInvoiceOpenForClosure({ ...paidClient, status: 'CANCELLED', balanceAmount: 100 }), false);
    });
});
