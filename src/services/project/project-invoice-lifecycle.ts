import { AppError } from '@/lib/error';

export type InvoiceTransition =
  | 'ISSUED'
  | 'SUBMIT_TO_SLT'
  | 'MARK_OVERDUE'
  | 'FOLLOW_UP'
  | 'COMPLETED'
  | 'CANCELLED';

export interface InvoiceLifecycleSnapshot {
  type?: string;
  status: string;
  submissionStatus: string;
  paymentStatus: string;
  totalAmount: unknown;
  paidAmount: unknown;
  balanceAmount: unknown;
  dueDate: Date | null;
  createdById: string | null;
}

export interface InvoiceTransitionInput {
  transition: InvoiceTransition;
  actorUserId: string;
  submissionReference?: string | null;
  submissionNotes?: string | null;
  now?: Date;
}

export interface InvoiceTransitionResult {
  data: Record<string, unknown>;
  shouldPostIssuance: boolean;
}

/**
 * Single state machine for the Project -> SLT -> Finance payment lifecycle.
 * ProjectInvoice.status remains the internal workflow status; submissionStatus
 * and paymentStatus are separate dimensions so SUBMITTED + PAYMENT_PENDING is
 * represented without losing either fact.
 */
export function applyInvoiceTransition(
  invoice: InvoiceLifecycleSnapshot,
  input: InvoiceTransitionInput,
): InvoiceTransitionResult {
  const now = input.now ?? new Date();
  const balance = Number(invoice.balanceAmount);
  const paid = Number(invoice.paidAmount);
  const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;

  if (!input.actorUserId) throw AppError.unauthorized('Authentication required');

  switch (input.transition) {
    case 'ISSUED':
      if (invoice.status !== 'DRAFT') throw AppError.badRequest('ONLY_DRAFT_INVOICES_CAN_BE_ISSUED');
      if (invoice.createdById && invoice.createdById === input.actorUserId) {
        throw AppError.badRequest('MAKER_CANNOT_ISSUE_OWN_INVOICE');
      }
      return {
        data: { status: 'ISSUED', approvedById: input.actorUserId, approvedAt: now },
        shouldPostIssuance: true,
      };

    case 'SUBMIT_TO_SLT':
      if (invoice.type && invoice.type !== 'CLIENT') throw AppError.badRequest('ONLY_CLIENT_INVOICES_CAN_BE_SUBMITTED_TO_SLT');
      if (invoice.status !== 'ISSUED') throw AppError.badRequest('ONLY_ISSUED_INVOICES_CAN_BE_SUBMITTED_TO_SLT');
      if (invoice.submissionStatus === 'SUBMITTED_TO_SLT') {
        throw AppError.badRequest('INVOICE_ALREADY_SUBMITTED_TO_SLT');
      }
      return {
        data: {
          submissionStatus: 'SUBMITTED_TO_SLT',
          paymentStatus: balance > 0 ? 'PENDING' : 'PAID',
          submittedAt: now,
          submittedById: input.actorUserId,
          submissionReference: input.submissionReference ?? null,
          submissionNotes: input.submissionNotes ?? null,
        },
        shouldPostIssuance: false,
      };

    case 'MARK_OVERDUE':
      if (invoice.submissionStatus !== 'SUBMITTED_TO_SLT') throw AppError.badRequest('INVOICE_MUST_BE_SUBMITTED_BEFORE_OVERDUE');
      if (!dueDate || dueDate >= now) throw AppError.badRequest('INVOICE_DUE_DATE_HAS_NOT_PASSED');
      if (balance <= 0 || paid >= Number(invoice.totalAmount)) throw AppError.badRequest('PAID_INVOICE_CANNOT_BE_OVERDUE');
      return {
        data: { status: 'FOLLOW_UP', paymentStatus: 'OVERDUE', followUpAt: now },
        shouldPostIssuance: false,
      };

    case 'FOLLOW_UP':
      if ((!invoice.type || invoice.type === 'CLIENT') && invoice.submissionStatus !== 'SUBMITTED_TO_SLT') throw AppError.badRequest('INVOICE_MUST_BE_SUBMITTED_BEFORE_FOLLOW_UP');
      if (!['PENDING', 'PARTIALLY_PAID', 'OVERDUE'].includes(invoice.paymentStatus)
          && !((invoice.type && invoice.type !== 'CLIENT') && ['ISSUED', 'PARTIALLY_PAID'].includes(invoice.status))) {
        throw AppError.badRequest('INVOICE_NOT_READY_FOR_FOLLOW_UP');
      }
      return { data: { status: 'FOLLOW_UP', followUpAt: now }, shouldPostIssuance: false };

    case 'COMPLETED':
      if (!['PAID', 'FULLY_PAID', 'FOLLOW_UP'].includes(invoice.status)
          || ((!invoice.type || invoice.type === 'CLIENT') && invoice.submissionStatus !== 'SUBMITTED_TO_SLT')
          || ((!invoice.type || invoice.type === 'CLIENT') && invoice.paymentStatus !== 'PAID')
          || !Number.isFinite(balance) || balance !== 0
          || !Number.isFinite(paid) || paid < Number(invoice.totalAmount)) {
        throw AppError.badRequest('INVOICE_MUST_BE_FULLY_PAID_BEFORE_COMPLETION');
      }
      return { data: { status: 'COMPLETED', completedAt: now }, shouldPostIssuance: false };

    case 'CANCELLED':
      if (!['DRAFT', 'ISSUED'].includes(invoice.status)) {
        throw AppError.badRequest('ONLY_DRAFT_OR_ISSUED_INVOICES_CAN_BE_CANCELLED');
      }
      if (invoice.submissionStatus === 'SUBMITTED_TO_SLT' || paid > 0) {
        throw AppError.badRequest('SUBMITTED_OR_PAID_INVOICES_REQUIRE_A_CREDIT_NOTE');
      }
      return { data: { status: 'CANCELLED' }, shouldPostIssuance: false };
  }
}
