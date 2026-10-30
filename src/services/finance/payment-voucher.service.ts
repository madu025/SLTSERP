import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { safe } from '@/utils/safe-await.util';
import { Prisma } from '@prisma/client';

export interface CreatePVInput {
  projectId: string;
  title: string;
  description?: string | null;
  type?: string;
  payeeName: string;
  payeeId?: string | null;
  invoiceId?: string | null;
  amount: number;
  paymentDate?: string | Date | null;
  paymentMethod?: string | null;
  bankName?: string | null;
  bankBranch?: string | null;
  accountNumber?: string | null;
  chequeNumber?: string | null;
  referenceNumber?: string | null;
  taxWithheld?: number;
  netAmount?: number;
  retentionAmount?: number;
  retentionReleaseId?: string | null;
  notes?: string | null;
  createdById?: string | null;
  contractorInvoiceId?: string | null;
}

export interface UpdateVoucherStatusOptions {
    approvedById?: string | null;
    paidById?: string | null;
    paidAt?: string | Date | null;
    paymentMethod?: string | null;
    bankName?: string | null;
    bankBranch?: string | null;
    accountNumber?: string | null;
    chequeNumber?: string | null;
    rejectionReason?: string | null;
    cancelledReason?: string | null;
}

export class PaymentVoucherService {
  /**
   * Get list of all Payment Vouchers with optional status, project and type filters
   */
  static async getPaymentVouchers(filters?: {
    status?: string;
    projectId?: string;
    type?: string;
  }) {
    const where: Record<string, unknown> = {};

    if (filters?.status && filters.status !== 'ALL') {
      where.status = filters.status;
    }
    if (filters?.projectId) {
      where.projectId = filters.projectId;
    }
    if (filters?.type) {
      where.type = filters.type;
    }

    return prisma.paymentVoucher.findMany({
      where,
      include: {
        project: {
          select: { name: true, projectCode: true }
        },
        invoice: {
          select: { invoiceNumber: true, status: true, title: true, totalAmount: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Get single Payment Voucher by ID
   */
  static async getPaymentVoucherById(id: string) {
    return prisma.paymentVoucher.findUnique({
      where: { id },
      include: {
        project: true,
        invoice: true
      }
    });
  }

  /**
   * Get list of payment vouchers for a specific project (Backwards Compatibility)
   */
  static async getVouchers(projectId: string) {
    return prisma.paymentVoucher.findMany({
      where: { projectId },
      include: {
        invoice: {
          select: { invoiceNumber: true, title: true, totalAmount: true }
        }
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Create new Payment Voucher with automatically generated PV number (PV-YEAR-XXXX)
   */
  static async createPaymentVoucher(data: CreatePVInput) {
    if (!Number.isFinite(data.amount) || data.amount <= 0) {
      throw AppError.badRequest('INVALID_PAYMENT_VOUCHER_AMOUNT');
    }
    if (new Prisma.Decimal(data.amount).decimalPlaces() > 2 || new Prisma.Decimal(data.amount).gt('999999999999.99')) {
      throw AppError.badRequest('INVALID_PAYMENT_VOUCHER_AMOUNT');
    }
    if ((data.taxWithheld !== undefined && (!Number.isFinite(data.taxWithheld) || data.taxWithheld < 0))
      || (data.retentionAmount !== undefined && (!Number.isFinite(data.retentionAmount) || data.retentionAmount < 0))) {
      throw AppError.badRequest('INVALID_PAYMENT_VOUCHER_DEDUCTION');
    }

    if (data.invoiceId) {
      const invoice = await prisma.projectInvoice.findUnique({
        where: { id: data.invoiceId }
      });
      if (!invoice) throw AppError.badRequest('INVOICE_NOT_FOUND');
      if (invoice.type === 'CLIENT') throw AppError.badRequest('CLIENT_INVOICES_REQUIRE_CUSTOMER_RECEIPTS');
      if (invoice.projectId !== data.projectId) throw AppError.badRequest('INVOICE_PROJECT_MISMATCH');
      if (invoice.type === 'CONTRACTOR') {
        if (data.type !== 'CONTRACTOR' || data.payeeId !== invoice.contractorId) {
          throw AppError.badRequest('CONTRACTOR_PAYMENT_PAYEE_MISMATCH');
        }
      }
      if (!['ISSUED', 'FOLLOW_UP', 'PARTIALLY_PAID'].includes(invoice.status)) {
        throw AppError.badRequest('VOUCHERS_REQUIRE_AN_ISSUED_INVOICE');
      }
      const existingPVs = await prisma.paymentVoucher.findMany({
        where: {
          invoiceId: data.invoiceId,
          status: { notIn: ['CANCELLED', 'REJECTED'] }
        },
        select: { amount: true }
      });
      const currentPaidSum = existingPVs.reduce((sum, pv) => sum.plus(pv.amount), new Prisma.Decimal(0));
      if (currentPaidSum.plus(data.amount).gt(invoice.totalAmount)) {
        throw AppError.badRequest('INVOICE_PAYMENT_EXCEEDS_TOTAL');
      }
    }

    const year = new Date().getFullYear();
    const count = await prisma.paymentVoucher.count({
      where: {
        createdAt: {
          gte: new Date(`${year}-01-01`),
          lt: new Date(`${year + 1}-01-01`)
        }
      }
    });

    const pvNumber = `PV-${year}-${(count + 1).toString().padStart(4, '0')}`;
    
    // Vendor Compliance Integration (Oracle Fusion Upgrade)
    let autoTaxWithheld = data.taxWithheld || 0;
    if (data.type === 'CONTRACTOR' && data.payeeId) {
      const contractor = await prisma.contractor.findUnique({
        where: { id: data.payeeId },
        select: { kycVerified: true, whtHoldStatus: true }
      });

      if (contractor) {
        if (!contractor.kycVerified) {
          throw AppError.badRequest('CONTRACTOR_KYC_FAILED', 'Contractor KYC is pending or rejected. Payment blocked.');
        }
        if (contractor.whtHoldStatus) {
          // Auto deduct 5% WHT if Contractor is flagged for WHT holding
          autoTaxWithheld = Math.max(autoTaxWithheld, data.amount * 0.05);
        }
      }
    }

    const calculatedNetAmount = data.amount - autoTaxWithheld - (data.retentionAmount || 0);
    if (!Number.isFinite(calculatedNetAmount) || calculatedNetAmount <= 0) {
      throw AppError.badRequest('INVALID_PAYMENT_VOUCHER_NET_AMOUNT');
    }

    let finalDescription = data.description || null;
    if (data.contractorInvoiceId) {
      finalDescription = `BOM_INVOICING_REF:${data.contractorInvoiceId}${data.description ? ` - ${data.description}` : ''}`;
    }

    return prisma.paymentVoucher.create({
      data: {
        pvNumber,
        projectId: data.projectId,
        title: data.title,
        description: finalDescription,
        type: data.type || 'CONTRACTOR',
        payeeName: data.payeeName,
        payeeId: data.payeeId || null,
        invoiceId: data.invoiceId || null,
        amount: data.amount,
        paymentDate: data.paymentDate ? new Date(data.paymentDate) : null,
        paymentMethod: data.paymentMethod || null,
        bankName: data.bankName || null,
        bankBranch: data.bankBranch || null,
        accountNumber: data.accountNumber || null,
        chequeNumber: data.chequeNumber || null,
        referenceNumber: data.referenceNumber || null,
        taxWithheld: autoTaxWithheld,
        netAmount: calculatedNetAmount,
        retentionAmount: data.retentionAmount || 0,
        retentionReleaseId: data.retentionReleaseId || null,
        notes: data.notes || null,
        status: 'DRAFT',
        createdById: data.createdById || null
      },
      include: { invoice: true }
    });
  }

  /**
   * Create a new payment voucher (Backwards Compatibility)
   */
  static async createVoucher(data: CreatePVInput) {
    return this.createPaymentVoucher(data);
  }

  /**
   * Update Payment Voucher details (only allowed if status is DRAFT)
   */
  static async updatePaymentVoucher(id: string, data: Partial<CreatePVInput>) {
    const existing = await prisma.paymentVoucher.findUnique({ where: { id } });
    if (!existing) throw AppError.badRequest('VOUCHER_NOT_FOUND');
    if (existing.status !== 'DRAFT') {
      throw AppError.badRequest('ONLY_DRAFT_VOUCHERS_CAN_BE_UPDATED');
    }

    const amount = data.amount !== undefined ? data.amount : existing.amount;
    const taxWithheld = data.taxWithheld !== undefined ? data.taxWithheld : existing.taxWithheld;
    const retentionAmount = data.retentionAmount !== undefined ? data.retentionAmount : existing.retentionAmount;
    const calculatedNetAmount = Number(amount) - Number(taxWithheld) - Number(retentionAmount);
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      throw AppError.badRequest('INVALID_PAYMENT_VOUCHER_AMOUNT');
    }
    if (new Prisma.Decimal(amount).decimalPlaces() > 2 || new Prisma.Decimal(amount).gt('999999999999.99')) {
      throw AppError.badRequest('INVALID_PAYMENT_VOUCHER_AMOUNT');
    }
    if (!Number.isFinite(Number(taxWithheld)) || Number(taxWithheld) < 0
      || !Number.isFinite(Number(retentionAmount)) || Number(retentionAmount) < 0
      || !Number.isFinite(calculatedNetAmount) || calculatedNetAmount <= 0) {
      throw AppError.badRequest('INVALID_PAYMENT_VOUCHER_DEDUCTION');
    }

    let finalDescription = data.description !== undefined ? data.description : existing.description;
    if (data.contractorInvoiceId !== undefined) {
      if (data.contractorInvoiceId) {
        finalDescription = `BOM_INVOICING_REF:${data.contractorInvoiceId}${data.description ? ` - ${data.description}` : ''}`;
      } else {
        if (finalDescription && finalDescription.startsWith('BOM_INVOICING_REF:')) {
          const parts = finalDescription.split(' - ');
          finalDescription = parts.slice(1).join(' - ') || null;
        }
      }
    }

    const targetInvoiceId = data.invoiceId !== undefined ? data.invoiceId : existing.invoiceId;
    if (targetInvoiceId) {
      const invoice = await prisma.projectInvoice.findUnique({
        where: { id: targetInvoiceId }
      });
      if (!invoice) throw AppError.badRequest('INVOICE_NOT_FOUND');
      if (invoice.type === 'CLIENT') throw AppError.badRequest('CLIENT_INVOICES_REQUIRE_CUSTOMER_RECEIPTS');
      if (invoice.projectId !== existing.projectId) throw AppError.badRequest('INVOICE_PROJECT_MISMATCH');
      if (invoice.type === 'CONTRACTOR') {
        const nextPayeeId = data.payeeId !== undefined ? data.payeeId : existing.payeeId;
        const nextType = data.type !== undefined ? data.type : existing.type;
        if (nextType !== 'CONTRACTOR' || nextPayeeId !== invoice.contractorId) {
          throw AppError.badRequest('CONTRACTOR_PAYMENT_PAYEE_MISMATCH');
        }
      }
      if (!['ISSUED', 'PARTIALLY_PAID'].includes(invoice.status)) {
        throw AppError.badRequest('VOUCHERS_REQUIRE_AN_ISSUED_INVOICE');
      }
      const existingPVs = await prisma.paymentVoucher.findMany({
        where: {
          invoiceId: targetInvoiceId,
          id: { not: id },
          status: { notIn: ['CANCELLED', 'REJECTED'] }
        },
        select: { amount: true }
      });
      const currentPaidSum = existingPVs.reduce((sum, pv) => sum.plus(pv.amount), new Prisma.Decimal(0));
      if (currentPaidSum.plus(amount).gt(invoice.totalAmount)) {
        throw AppError.badRequest('INVOICE_PAYMENT_EXCEEDS_TOTAL');
      }
    }

    return prisma.paymentVoucher.update({
      where: { id },
      data: {
        title: data.title,
        description: finalDescription,
        type: data.type,
        payeeName: data.payeeName,
        payeeId: data.payeeId,
        invoiceId: data.invoiceId,
        amount,
        paymentDate: data.paymentDate ? new Date(data.paymentDate) : undefined,
        paymentMethod: data.paymentMethod,
        bankName: data.bankName,
        bankBranch: data.bankBranch,
        accountNumber: data.accountNumber,
        chequeNumber: data.chequeNumber,
        referenceNumber: data.referenceNumber,
        taxWithheld,
        netAmount: calculatedNetAmount,
        retentionAmount,
        retentionReleaseId: data.retentionReleaseId,
        notes: data.notes
      }
    });
  }

  /**
   * Approve, Authorize, Reject or Pay a Payment Voucher (Finance API style)
   */
  static async updatePaymentVoucherStatus(
    id: string,
    status: string,
    userId: string,
    options?: {
      rejectionReason?: string;
      cancelledReason?: string;
    }
  ) {
    const validStatuses = ['PENDING_APPROVAL', 'APPROVED', 'PAID', 'REJECTED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      throw AppError.badRequest('INVALID_STATUS');
    }

    const existing = await prisma.paymentVoucher.findUnique({ where: { id } });
    if (!existing) throw AppError.badRequest('VOUCHER_NOT_FOUND');

    // Enforce proper state machine transitions and protect terminal states
    const currentStatus = existing.status;
    if (currentStatus === 'PAID' || currentStatus === 'CANCELLED' || currentStatus === 'REJECTED') {
      throw AppError.badRequest(`CANNOT_CHANGE_STATUS_FROM_TERMINAL_STATE_${currentStatus}`);
    }

    if (status === 'PENDING_APPROVAL' && currentStatus !== 'DRAFT') {
      throw AppError.badRequest('ONLY_DRAFT_VOUCHERS_CAN_BE_SUBMITTED_FOR_APPROVAL');
    }
    if (status === 'PENDING_APPROVAL' && existing.createdById && existing.createdById !== userId) {
      throw AppError.badRequest('ONLY_VOUCHER_MAKER_CAN_SUBMIT_FOR_APPROVAL');
    }
    if (status === 'APPROVED' && currentStatus !== 'PENDING_APPROVAL') {
      throw AppError.badRequest('ONLY_PENDING_APPROVAL_VOUCHERS_CAN_BE_APPROVED');
    }
    if (status === 'PAID' && currentStatus !== 'APPROVED') {
      throw AppError.badRequest('ONLY_APPROVED_VOUCHERS_CAN_BE_PAID');
    }
    if (status === 'REJECTED' && currentStatus !== 'PENDING_APPROVAL') {
      throw AppError.badRequest('ONLY_PENDING_APPROVAL_VOUCHERS_CAN_BE_REJECTED');
    }
    if (status === 'CANCELLED' && !['DRAFT', 'PENDING_APPROVAL', 'APPROVED'].includes(currentStatus)) {
      throw AppError.badRequest('VOUCHER_CANNOT_BE_CANCELLED_FROM_CURRENT_STATUS');
    }
    if (['APPROVED', 'PAID'].includes(status) && existing.createdById && existing.createdById === userId) {
      throw AppError.badRequest('MAKER_CANNOT_APPROVE_OR_PAY_OWN_VOUCHER');
    }

    return prisma.$transaction(async (tx) => {
      // Lock before posting the ledger or reading settlement balances, matching
      // the receipt path's invoice-first settlement lock ordering.
      if (status === 'PAID' && existing.invoiceId) {
        await tx.$queryRaw`SELECT "id" FROM "ProjectInvoice" WHERE "id" = ${existing.invoiceId}::uuid FOR UPDATE`;
      }
      const updateData: Record<string, unknown> = { status };

      if (status === 'APPROVED') {
        updateData.approvedById = userId;
        updateData.approvedAt = new Date();
      } else if (status === 'PAID') {
        updateData.paidById = userId;
        updateData.paidAt = new Date();
        updateData.paymentDate = new Date();
      } else if (status === 'REJECTED') {
        updateData.rejectionReason = options?.rejectionReason || 'No reason provided';
      } else if (status === 'CANCELLED') {
        updateData.cancelledReason = options?.cancelledReason || 'No reason provided';
      }

      // Make the state transition compare-and-set. This prevents two
      // concurrent requests from both paying/approving the same voucher.
      const transition = await tx.paymentVoucher.updateMany({
        where: { id, status: currentStatus },
        data: updateData,
      });
      if (transition.count !== 1) {
        throw AppError.conflict('VOUCHER_STATUS_CHANGED_RETRY');
      }
      const updatedVoucher = await tx.paymentVoucher.findUniqueOrThrow({ where: { id } });

      // Update invoice paid amount if transitions to PAID
      if (status === 'PAID') {
        // Log payment voucher payout in General Ledger
        const { LedgerService } = await import('./ledger.service');
        await LedgerService.logPaymentVoucherPayment(
          tx, id, Number(existing.amount), existing.type || 'CONTRACTOR', existing.pvNumber, existing.payeeName
        );

        // Sync with monthly Contractor Invoice if BOM-based
        if (existing.description && existing.description.startsWith('BOM_INVOICING_REF:')) {
          const bomInvoiceId = existing.description.split(':')[1];
          const [err] = await safe(tx.invoice.update({
            where: { id: bomInvoiceId },
            data: {
              status: 'PAID',
              statusA: 'PAID',
              statusB: 'PAID',
              paidDateA: new Date(),
              paidDateB: new Date()
            }
          }));
          if (err) {
            console.error('Failed to sync monthly Contractor Invoice status from BOM PV:', err);
          }
        }

        if (existing.invoiceId) {
          const invoice = await tx.projectInvoice.findUnique({
            where: { id: existing.invoiceId }
          });
          if (!invoice) throw AppError.badRequest('INVOICE_NOT_FOUND');
          if (invoice.type === 'CLIENT') throw AppError.badRequest('CLIENT_INVOICES_REQUIRE_CUSTOMER_RECEIPTS');
          if (invoice.projectId !== existing.projectId) throw AppError.badRequest('INVOICE_PROJECT_MISMATCH');
          if (!['ISSUED', 'FOLLOW_UP', 'PARTIALLY_PAID'].includes(invoice.status)) {
            throw AppError.badRequest('PAYMENT_REQUIRES_AN_ISSUED_INVOICE');
          }
          const settlementAmount = new Prisma.Decimal(existing.amount);
          if (!settlementAmount.isFinite() || settlementAmount.lte(0) || settlementAmount.decimalPlaces() > 2) {
            throw AppError.badRequest('INVALID_PAYMENT_VOUCHER_AMOUNT');
          }
          if (settlementAmount.gt(invoice.balanceAmount)
            || settlementAmount.gt(new Prisma.Decimal(invoice.totalAmount).minus(invoice.paidAmount))) {
            throw AppError.badRequest('INVOICE_PAYMENT_EXCEEDS_BALANCE');
          }
          const newPaidAmount = new Prisma.Decimal(invoice.paidAmount).plus(settlementAmount);
          const newBalance = new Prisma.Decimal(invoice.totalAmount).minus(newPaidAmount);
          await tx.projectInvoice.update({
            where: { id: existing.invoiceId },
            data: {
              paidAmount: newPaidAmount,
              balanceAmount: newBalance,
              status: newBalance.isZero() ? 'FULLY_PAID' : 'PARTIALLY_PAID',
            },
          });
        }
      }

      return updatedVoucher;
    });
  }

  /**
   * Update PV status and handle transaction cascades (Project API style)
   */
  static async updateVoucherStatus(id: string, status: string, options: UpdateVoucherStatusOptions, actorUserId?: string) {
    const actorId = actorUserId || options.approvedById || options.paidById;
    if (!actorId) throw AppError.badRequest('AUTHENTICATED_ACTOR_REQUIRED');

    // Keep this compatibility entry point fail-closed as well. Some older
    // callers still use it instead of updatePaymentVoucherStatus directly.
    const validStatuses = ['PENDING_APPROVAL', 'APPROVED', 'PAID', 'REJECTED', 'CANCELLED'];
    if (!validStatuses.includes(status)) throw AppError.badRequest('INVALID_STATUS');
    const existing = await prisma.paymentVoucher.findUnique({ where: { id } });
    if (!existing) throw AppError.badRequest('VOUCHER_NOT_FOUND');
    const currentStatus = existing.status;
    if (status === 'PAID' && currentStatus !== 'APPROVED') {
      throw AppError.badRequest('ONLY_APPROVED_VOUCHERS_CAN_BE_PAID');
    }

    return this.updatePaymentVoucherStatus(id, status, actorId, {
      rejectionReason: options.rejectionReason || undefined,
      cancelledReason: options.cancelledReason || undefined,
    });
  }

  /**
   * Delete a Payment Voucher (only if DRAFT)
   */
  static async deletePaymentVoucher(id: string) {
    const existing = await prisma.paymentVoucher.findUnique({ where: { id } });
    if (!existing) throw AppError.badRequest('VOUCHER_NOT_FOUND');
    if (existing.status !== 'DRAFT') {
      throw AppError.badRequest('ONLY_DRAFT_VOUCHERS_CAN_BE_DELETED');
    }

    return prisma.paymentVoucher.delete({ where: { id } });
  }

  /**
   * Delete payment voucher (DRAFT only - Backwards Compatibility)
   */
  static async deleteVoucher(id: string) {
    const [error] = await safe(this.deletePaymentVoucher(id));
    if (error) {
      if (error instanceof Error && error.message === 'VOUCHER_NOT_FOUND') {
        throw AppError.badRequest('PAYMENT_VOUCHER_NOT_FOUND');
      }
      if (error instanceof Error && error.message === 'ONLY_DRAFT_VOUCHERS_CAN_BE_DELETED') {
        throw AppError.badRequest('DRAFT_ONLY_DELETION');
      }
      throw error;
    }
    return { success: true };
  }
}
