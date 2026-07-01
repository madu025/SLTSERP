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
  paymentMethod?: string | null;
  bankName?: string | null;
  bankBranch?: string | null;
  accountNumber?: string | null;
  chequeNumber?: string | null;
  referenceNumber?: string | null;
  taxWithheld?: number;
  netAmount?: number;
  retentionAmount?: number;
  notes?: string | null;
  createdById?: string | null;
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
          select: { invoiceNumber: true, status: true }
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
   * Create new Payment Voucher with automatically generated PV number
   */
  static async createPaymentVoucher(data: CreatePVInput) {
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
        paymentMethod: data.paymentMethod || null,
        bankName: data.bankName || null,
        bankBranch: data.bankBranch || null,
        accountNumber: data.accountNumber || null,
        chequeNumber: data.chequeNumber || null,
        referenceNumber: data.referenceNumber || null,
        taxWithheld: data.taxWithheld || 0,
        netAmount: data.netAmount !== undefined ? data.netAmount : calculatedNetAmount,
        retentionAmount: data.retentionAmount || 0,
        notes: data.notes || null,
        status: 'DRAFT',
        createdById: data.createdById || 'system'
      }
    });
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
        paymentMethod: data.paymentMethod,
        bankName: data.bankName,
        bankBranch: data.bankBranch,
        accountNumber: data.accountNumber,
        chequeNumber: data.chequeNumber,
        referenceNumber: data.referenceNumber,
        taxWithheld,
        netAmount: data.netAmount !== undefined ? data.netAmount : calculatedNetAmount,
        retentionAmount,
        notes: data.notes
      }
    });
  }

  /**
   * Approve, Authorize, Reject or Pay a Payment Voucher
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

    return prisma.paymentVoucher.update({
      where: { id },
      data: updateData
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
}
