import { prisma } from '@/lib/prisma';

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
    const where: any = {};

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
    if (data.invoiceId) {
      const invoice = await prisma.projectInvoice.findUnique({
        where: { id: data.invoiceId }
      });
      if (invoice) {
        const existingPVs = await prisma.paymentVoucher.findMany({
          where: {
            invoiceId: data.invoiceId,
            status: { notIn: ['CANCELLED', 'REJECTED'] }
          },
          select: { amount: true }
        });
        const currentPaidSum = existingPVs.reduce((sum, pv) => sum + pv.amount, 0);
        if (currentPaidSum + data.amount > invoice.totalAmount) {
          throw new Error('INVOICE_PAYMENT_EXCEEDS_TOTAL');
        }
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
    const calculatedNetAmount = data.amount - (data.taxWithheld || 0) - (data.retentionAmount || 0);

    return prisma.paymentVoucher.create({
      data: {
        pvNumber,
        projectId: data.projectId,
        title: data.title,
        description: data.description || null,
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
        taxWithheld: data.taxWithheld || 0,
        netAmount: data.netAmount !== undefined ? data.netAmount : calculatedNetAmount,
        retentionAmount: data.retentionAmount || 0,
        retentionReleaseId: data.retentionReleaseId || null,
        notes: data.notes || null,
        status: 'DRAFT',
        createdById: data.createdById || 'system'
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
    if (!existing) throw new Error('VOUCHER_NOT_FOUND');
    if (existing.status !== 'DRAFT') {
      throw new Error('ONLY_DRAFT_VOUCHERS_CAN_BE_UPDATED');
    }

    const amount = data.amount !== undefined ? data.amount : existing.amount;
    const taxWithheld = data.taxWithheld !== undefined ? data.taxWithheld : existing.taxWithheld;
    const retentionAmount = data.retentionAmount !== undefined ? data.retentionAmount : existing.retentionAmount;
    const calculatedNetAmount = amount - taxWithheld - retentionAmount;

    const targetInvoiceId = data.invoiceId !== undefined ? data.invoiceId : existing.invoiceId;
    if (targetInvoiceId) {
      const invoice = await prisma.projectInvoice.findUnique({
        where: { id: targetInvoiceId }
      });
      if (invoice) {
        const existingPVs = await prisma.paymentVoucher.findMany({
          where: {
            invoiceId: targetInvoiceId,
            id: { not: id },
            status: { notIn: ['CANCELLED', 'REJECTED'] }
          },
          select: { amount: true }
        });
        const currentPaidSum = existingPVs.reduce((sum, pv) => sum + pv.amount, 0);
        if (currentPaidSum + amount > invoice.totalAmount) {
          throw new Error('INVOICE_PAYMENT_EXCEEDS_TOTAL');
        }
      }
    }

    return prisma.paymentVoucher.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
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
        netAmount: data.netAmount !== undefined ? data.netAmount : calculatedNetAmount,
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
      throw new Error('INVALID_STATUS');
    }

    const existing = await prisma.paymentVoucher.findUnique({ where: { id } });
    if (!existing) throw new Error('VOUCHER_NOT_FOUND');

    // Enforce proper state machine transitions and protect terminal states
    const currentStatus = existing.status;
    if (currentStatus === 'PAID' || currentStatus === 'CANCELLED' || currentStatus === 'REJECTED') {
      throw new Error(`CANNOT_CHANGE_STATUS_FROM_TERMINAL_STATE_${currentStatus}`);
    }

    if (status === 'PENDING_APPROVAL' && currentStatus !== 'DRAFT') {
      throw new Error('ONLY_DRAFT_VOUCHERS_CAN_BE_SUBMITTED_FOR_APPROVAL');
    }
    if (status === 'APPROVED' && currentStatus !== 'PENDING_APPROVAL') {
      throw new Error('ONLY_PENDING_APPROVAL_VOUCHERS_CAN_BE_APPROVED');
    }
    if (status === 'PAID' && currentStatus !== 'APPROVED') {
      throw new Error('ONLY_APPROVED_VOUCHERS_CAN_BE_PAID');
    }

    return prisma.$transaction(async (tx) => {
      const updateData: any = { status };

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

      const updatedVoucher = await tx.paymentVoucher.update({
        where: { id },
        data: updateData
      });

      // Update invoice paid amount if transitions to PAID
      if (status === 'PAID') {
        // Log payment voucher payout in General Ledger
        const { LedgerService } = await import('./ledger.service');
        await LedgerService.logPaymentVoucherPayment(
          tx, id, existing.amount, existing.type || 'CONTRACTOR', existing.pvNumber, existing.payeeName
        );

        // Sync with monthly Contractor Invoice if BOM-based
        if (existing.description && existing.description.startsWith('BOM_INVOICING_REF:')) {
          const bomInvoiceId = existing.description.split(':')[1];
          try {
            await tx.invoice.update({
              where: { id: bomInvoiceId },
              data: {
                status: 'PAID',
                statusA: 'PAID',
                statusB: 'PAID',
                paidDateA: new Date(),
                paidDateB: new Date()
              }
            });
          } catch (err) {
            console.error('Failed to sync monthly Contractor Invoice status from BOM PV:', err);
          }
        }

        if (existing.invoiceId) {
          const invoice = await tx.projectInvoice.findUnique({
            where: { id: existing.invoiceId }
          });
          if (invoice) {
            const newPaidAmount = (invoice.paidAmount || 0) + existing.amount;
            const newBalance = invoice.totalAmount - newPaidAmount;
            await tx.projectInvoice.update({
              where: { id: existing.invoiceId },
              data: {
                paidAmount: newPaidAmount,
                balanceAmount: Math.max(0, newBalance),
                status: newBalance <= 0 ? 'FULLY_PAID' : 'PARTIALLY_PAID',
              },
            });
          }
        }
      }

      return updatedVoucher;
    });
  }

  /**
   * Update PV status and handle transaction cascades (Project API style)
   */
  static async updateVoucherStatus(id: string, status: string, options: UpdateVoucherStatusOptions) {
    const existing = await prisma.paymentVoucher.findUnique({ where: { id } });
    if (!existing) {
      throw new Error('PAYMENT_VOUCHER_NOT_FOUND');
    }

    return prisma.$transaction(async (tx) => {
      const updateData: Record<string, unknown> = { status };

      switch (status) {
        case 'APPROVED':
          if (!options.approvedById) {
            throw new Error('APPROVED_BY_ID_REQUIRED');
          }
          updateData.approvedById = options.approvedById;
          updateData.approvedAt = new Date();
          break;
        case 'PAID':
          updateData.paidById = options.paidById || null;
          updateData.paidAt = options.paidAt ? new Date(options.paidAt) : new Date();
          updateData.paymentDate = options.paidAt ? new Date(options.paidAt) : new Date();
          if (options.paymentMethod) updateData.paymentMethod = options.paymentMethod;
          if (options.bankName) updateData.bankName = options.bankName;
          if (options.bankBranch) updateData.bankBranch = options.bankBranch;
          if (options.accountNumber) updateData.accountNumber = options.accountNumber;
          if (options.chequeNumber) updateData.chequeNumber = options.chequeNumber;
          break;
        case 'REJECTED':
          updateData.rejectionReason = options.rejectionReason || 'Rejected';
          break;
        case 'CANCELLED':
          updateData.cancelledReason = options.cancelledReason || 'Cancelled';
          break;
        default:
          break;
      }

      const updatedVoucher = await tx.paymentVoucher.update({
        where: { id },
        data: updateData,
        include: { invoice: true },
      });

      // If status is PAID and linked to an invoice, update invoice paidAmount
      if (status === 'PAID' && existing.invoiceId) {
        const invoice = await tx.projectInvoice.findUnique({
          where: { id: existing.invoiceId }
        });
        if (invoice) {
          const newPaidAmount = (invoice.paidAmount || 0) + existing.amount;
          const newBalance = invoice.totalAmount - newPaidAmount;
          await tx.projectInvoice.update({
            where: { id: existing.invoiceId },
            data: {
              paidAmount: newPaidAmount,
              balanceAmount: Math.max(0, newBalance),
              status: newBalance <= 0 ? 'FULLY_PAID' : 'PARTIALLY_PAID',
            },
          });
        }
      }

      return updatedVoucher;
    });
  }

  /**
   * Delete a Payment Voucher (only if DRAFT)
   */
  static async deletePaymentVoucher(id: string) {
    const existing = await prisma.paymentVoucher.findUnique({ where: { id } });
    if (!existing) throw new Error('VOUCHER_NOT_FOUND');
    if (existing.status !== 'DRAFT') {
      throw new Error('ONLY_DRAFT_VOUCHERS_CAN_BE_DELETED');
    }

    return prisma.paymentVoucher.delete({ where: { id } });
  }

  /**
   * Delete payment voucher (DRAFT only - Backwards Compatibility)
   */
  static async deleteVoucher(id: string) {
    try {
      await this.deletePaymentVoucher(id);
      return { success: true };
    } catch (error) {
      if (error instanceof Error && error.message === 'VOUCHER_NOT_FOUND') {
        throw new Error('PAYMENT_VOUCHER_NOT_FOUND');
      }
      if (error instanceof Error && error.message === 'ONLY_DRAFT_VOUCHERS_CAN_BE_DELETED') {
        throw new Error('DRAFT_ONLY_DELETION');
      }
      throw error;
    }
  }
}
