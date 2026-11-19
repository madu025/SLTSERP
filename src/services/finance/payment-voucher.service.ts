import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { safe } from '@/utils/safe-await.util';
import { Prisma } from '@prisma/client';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { sodVoucherIdsInScope } from '@/lib/payment-voucher-access';
import { ApprovalLimitService } from '@/services/procurement/approval-limit.service';

export interface CreatePVInput {
  /** Required for project vouchers; a vendor payment (supplierInvoiceId) has no project. */
  projectId?: string | null;
  supplierInvoiceId?: string | null;
  vendorId?: string | null;
  bankAccountId?: string | null;
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
  }, userId?: string | null) {
    const scope = await resolveOpmcScope(userId);
    const where: Record<string, unknown> = {};
    if (scope !== undefined) {
      // project vouchers by the area of their project; contractor invoice vouchers (no project) by the area of the contractor
      const sodIds = await sodVoucherIdsInScope(scope);
      where.OR = [{ project: { opmcId: { in: scope } } }, ...(sodIds.length ? [{ id: { in: sodIds } }] : [])];
    }

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

  /** A voucher that pays out retention must point at a real release of this project and cannot exceed it (with the other live vouchers). */
  private static async assertRetentionReleaseCoversVoucher(projectId: string, releaseId: string, amount: number, excludeVoucherId?: string) {
    const release = await prisma.retentionRelease.findUnique({
      where: { id: releaseId },
      select: { releaseAmount: true, retention: { select: { projectId: true } } },
    });
    if (!release) throw AppError.badRequest('RETENTION_RELEASE_NOT_FOUND');
    if (release.retention.projectId !== projectId) throw AppError.badRequest('RETENTION_RELEASE_PROJECT_MISMATCH');
    const others = await prisma.paymentVoucher.findMany({
      where: { retentionReleaseId: releaseId, status: { notIn: ['CANCELLED', 'REJECTED'] }, ...(excludeVoucherId ? { id: { not: excludeVoucherId } } : {}) },
      select: { amount: true },
    });
    const used = others.reduce((sum, v) => sum.plus(v.amount), new Prisma.Decimal(0));
    if (used.plus(amount).gt(release.releaseAmount)) throw AppError.badRequest('RETENTION_PAYOUT_EXCEEDS_RELEASE');
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

    // A vendor payment pays an approved supplier invoice, in full or in part, from a bank account; it belongs to no project.
    let vendorPayment: { vendorId: string; vendorName: string } | null = null;
    if (data.supplierInvoiceId) {
      const si = await prisma.supplierInvoice.findUnique({ where: { id: data.supplierInvoiceId }, include: { vendor: { select: { name: true } } } });
      if (!si) throw AppError.badRequest('SUPPLIER_INVOICE_NOT_FOUND');
      if (!['APPROVED', 'PARTIALLY_PAID'].includes(si.status)) throw AppError.badRequest('SUPPLIER_INVOICE_MUST_BE_APPROVED_BEFORE_PAYMENT');
      const live = await prisma.paymentVoucher.findMany({ where: { supplierInvoiceId: si.id, status: { notIn: ['CANCELLED', 'REJECTED'] } }, select: { amount: true } });
      const committed = live.reduce((sum, pv) => sum.plus(pv.amount), new Prisma.Decimal(0));
      if (committed.plus(data.amount).gt(si.totalAmount)) throw AppError.badRequest('SUPPLIER_INVOICE_PAYMENT_EXCEEDS_TOTAL');
      vendorPayment = { vendorId: si.vendorId, vendorName: si.vendor.name };
    } else if (!data.projectId && !data.contractorInvoiceId) {
      throw AppError.badRequest('PROJECT_REQUIRED');
    }

    // A monthly contractor (SOD) invoice is not tied to a project: it is paid on its own approval, like a vendor payment (company-wide finance access)
    if (!vendorPayment && !data.projectId && data.contractorInvoiceId) {
      const sod = await prisma.invoice.findUnique({ where: { id: data.contractorInvoiceId }, select: { contractorId: true, approvalStatus: true, amount: true, projectId: true } });
      if (!sod) throw AppError.badRequest('CONTRACTOR_INVOICE_NOT_FOUND');
      if (sod.projectId) throw AppError.badRequest('INVOICE_PROJECT_MISMATCH');
      if (sod.approvalStatus !== 'APPROVED') throw AppError.badRequest('THE_CONTRACTOR_INVOICE_MUST_BE_APPROVED_FIRST');
      if (data.type !== 'CONTRACTOR' || data.payeeId !== sod.contractorId) throw AppError.badRequest('CONTRACTOR_PAYMENT_PAYEE_MISMATCH');
      const liveSod = await prisma.paymentVoucher.findMany({ where: { description: { startsWith: `BOM_INVOICING_REF:${data.contractorInvoiceId}` }, status: { notIn: ['CANCELLED', 'REJECTED'] } }, select: { amount: true } });
      const committedSod = liveSod.reduce((sum, pv) => sum.plus(pv.amount), new Prisma.Decimal(0));
      if (committedSod.plus(data.amount).gt(sod.amount)) throw AppError.badRequest('INVOICE_PAYMENT_EXCEEDS_TOTAL');
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

    if (data.retentionReleaseId && data.projectId) {
      await this.assertRetentionReleaseCoversVoucher(data.projectId, data.retentionReleaseId, data.amount);
    }

    const year = new Date().getFullYear();

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

    // The PV number is allocated under a lock on the series: two vouchers created together used to read the same
    // count and one failed on the unique constraint.
    return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('payment-voucher-number', 0))`;
    const last = await tx.paymentVoucher.findFirst({
      where: { pvNumber: { startsWith: `PV-${year}-` } },
      orderBy: { pvNumber: 'desc' },
      select: { pvNumber: true },
    });
    const lastSeq = last ? parseInt(last.pvNumber.slice(`PV-${year}-`.length), 10) : 0;
    const pvNumber = `PV-${year}-${((Number.isNaN(lastSeq) ? 0 : lastSeq) + 1).toString().padStart(4, '0')}`;
    return tx.paymentVoucher.create({
      data: {
        pvNumber,
        projectId: vendorPayment ? null : (data.projectId ?? null),
        supplierInvoiceId: data.supplierInvoiceId || null,
        vendorId: vendorPayment?.vendorId ?? null,
        bankAccountId: data.bankAccountId || null,
        title: data.title,
        description: finalDescription,
        type: vendorPayment ? 'VENDOR' : (data.type || 'CONTRACTOR'),
        payeeName: vendorPayment ? vendorPayment.vendorName : data.payeeName,
        payeeId: vendorPayment ? vendorPayment.vendorId : (data.payeeId || null),
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

    if (data.retentionReleaseId && existing.projectId) {
      await this.assertRetentionReleaseCoversVoucher(existing.projectId, data.retentionReleaseId, Number(amount), id);
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
      /** Head Office confirmation (PAID): Head Office's own payment reference and the date it paid */
      hoReference?: string;
      hoPaidDate?: string | Date;
      /** Returning a submitted voucher to APPROVED: why Head Office sent it back */
      returnReason?: string;
      /** The actor is an OSP user recording a confirmation that Head Office gave (not Head Office itself) */
      recordedOnBehalf?: boolean;
    }
  ) {
    const validStatuses = ['PENDING_APPROVAL', 'APPROVED', 'SUBMITTED_TO_HO', 'PAID', 'REJECTED', 'CANCELLED'];
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
    if (status === 'APPROVED' && !['PENDING_APPROVAL', 'SUBMITTED_TO_HO'].includes(currentStatus)) {
      throw AppError.badRequest('ONLY_PENDING_APPROVAL_VOUCHERS_CAN_BE_APPROVED');
    }
    if (status === 'SUBMITTED_TO_HO' && currentStatus !== 'APPROVED') {
      throw AppError.badRequest('ONLY_APPROVED_VOUCHERS_CAN_BE_SUBMITTED_TO_HEAD_OFFICE');
    }
    if (status === 'SUBMITTED_TO_HO' && existing.approvedById && existing.approvedById === userId) {
      throw AppError.badRequest('APPROVER_CANNOT_SUBMIT_THE_VOUCHER_THEY_APPROVED');
    }
    if (status === 'PAID' && currentStatus !== 'SUBMITTED_TO_HO') {
      throw AppError.badRequest('ONLY_VOUCHERS_SUBMITTED_TO_HEAD_OFFICE_CAN_BE_CONFIRMED_PAID');
    }
    if (status === 'PAID' && (!options?.hoReference?.trim() || !options?.hoPaidDate)) {
      throw AppError.badRequest('HO_REFERENCE_AND_DATE_REQUIRED: enter the Head Office payment reference and the date it paid');
    }
    if (status === 'PAID' && existing.submittedToHoById && existing.submittedToHoById === userId) {
      throw AppError.badRequest('SUBMITTER_CANNOT_CONFIRM_HEAD_OFFICE_PAYMENT');
    }
    if (status === 'APPROVED' && currentStatus === 'SUBMITTED_TO_HO' && !options?.returnReason?.trim()) {
      throw AppError.badRequest('RETURN_REASON_REQUIRED');
    }
    if (status === 'REJECTED' && currentStatus !== 'PENDING_APPROVAL') {
      throw AppError.badRequest('ONLY_PENDING_APPROVAL_VOUCHERS_CAN_BE_REJECTED');
    }
    if (status === 'CANCELLED' && !['DRAFT', 'PENDING_APPROVAL', 'APPROVED'].includes(currentStatus)) {
      throw AppError.badRequest('VOUCHER_CANNOT_BE_CANCELLED_FROM_CURRENT_STATUS');
    }
    const returningFromHo = status === 'APPROVED' && currentStatus === 'SUBMITTED_TO_HO';
    if ((status === 'PAID' || (status === 'APPROVED' && !returningFromHo)) && existing.createdById && existing.createdById === userId) {
      throw AppError.badRequest('MAKER_CANNOT_APPROVE_OR_PAY_OWN_VOUCHER');
    }
    // Approving commits Head Office's money: the approver's limit (role limit, or the manager limit) must cover the request
    if (status === 'APPROVED' && !returningFromHo) {
      await ApprovalLimitService.assertCanApprove(userId, Number(existing.netAmount), 'PAYMENT_VOUCHER', id);
    }

    return prisma.$transaction(async (tx) => {
      // Lock before posting the ledger or reading settlement balances, matching
      // the receipt path's invoice-first settlement lock ordering.
      if (status === 'PAID' && existing.invoiceId) {
        await tx.$queryRaw`SELECT "id" FROM "ProjectInvoice" WHERE "id" = ${existing.invoiceId}::uuid FOR UPDATE`;
      }
      if (status === 'PAID' && existing.supplierInvoiceId) {
        await tx.$queryRaw`SELECT "id" FROM "SupplierInvoice" WHERE "id" = ${existing.supplierInvoiceId}::uuid FOR UPDATE`;
      }
      const updateData: Record<string, unknown> = { status };

      if (status === 'APPROVED' && currentStatus === 'SUBMITTED_TO_HO') {
        // Head Office sent it back: it returns to the approved queue for OSP Finance to correct or resubmit
        updateData.submittedToHoAt = null;
        updateData.submittedToHoById = null;
        updateData.hoBatchId = null;
        updateData.notes = `${existing.notes ? existing.notes + ' | ' : ''}Returned by Head Office: ${options!.returnReason!.trim()}`;
      } else if (status === 'APPROVED') {
        updateData.approvedById = userId;
        updateData.approvedAt = new Date();
      } else if (status === 'SUBMITTED_TO_HO') {
        updateData.submittedToHoById = userId;
        updateData.submittedToHoAt = new Date();
      } else if (status === 'PAID') {
        const paidOn = new Date(options!.hoPaidDate!);
        if (Number.isNaN(paidOn.getTime())) throw AppError.badRequest('HO_PAID_DATE_INVALID');
        updateData.paidById = userId;
        updateData.confirmedById = userId;
        updateData.paidAt = new Date();
        updateData.paymentDate = paidOn;
        updateData.hoPaidDate = paidOn;
        updateData.hoReference = options!.hoReference!.trim();
        updateData.recordedOnBehalf = !!options?.recordedOnBehalf;
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
        // Head Office pays on OSP's behalf: the credit is the OSP current account with Head Office (a bank GL only for vouchers
        // created before this model, which carry their own bank account)
        const bank = existing.bankAccountId ? await tx.bankAccount.findUnique({ where: { id: existing.bankAccountId }, select: { glAccountCode: true } }) : null;
        await LedgerService.logPaymentVoucherPayment(
          tx, id, Number(existing.amount), existing.type || 'CONTRACTOR', existing.pvNumber, existing.payeeName, undefined,
          { taxWithheld: Number(existing.taxWithheld ?? 0), retentionAmount: Number(existing.retentionAmount ?? 0), releasesRetention: !!existing.retentionReleaseId, bankAccountCode: bank?.glAccountCode }
        );

        // Vendor payment: move the supplier invoice towards PAID in the same transaction
        if (existing.supplierInvoiceId) {
          const si = await tx.supplierInvoice.findUnique({ where: { id: existing.supplierInvoiceId } });
          if (!si) throw AppError.badRequest('SUPPLIER_INVOICE_NOT_FOUND');
          const paid = new Prisma.Decimal(si.paidAmount).plus(existing.amount);
          if (paid.gt(si.totalAmount)) throw AppError.badRequest('SUPPLIER_INVOICE_PAYMENT_EXCEEDS_TOTAL');
          const settled = paid.gte(si.totalAmount);
          await tx.supplierInvoice.update({ where: { id: si.id }, data: { paidAmount: paid, status: settled ? 'PAID' : 'PARTIALLY_PAID', paidAt: settled ? new Date() : null } });
        }

        // Sync with monthly Contractor Invoice if BOM-based: it is PAID only once Head Office has confirmed payments covering its amount
        if (existing.description && existing.description.startsWith('BOM_INVOICING_REF:')) {
          const bomInvoiceId = existing.description.split(':')[1].split(' - ')[0].trim();
          const bom = await tx.invoice.findUnique({ where: { id: bomInvoiceId }, select: { amount: true } });
          if (bom) {
            const paidSoFar = await tx.paymentVoucher.aggregate({ where: { description: { startsWith: `BOM_INVOICING_REF:${bomInvoiceId}` }, status: 'PAID' }, _sum: { amount: true } });
            if (new Prisma.Decimal(paidSoFar._sum.amount ?? 0).gte(bom.amount)) {
              const [err] = await safe(tx.invoice.update({
                where: { id: bomInvoiceId },
                data: { status: 'PAID', statusA: 'PAID', statusB: 'PAID', paidDateA: new Date(), paidDateB: new Date() },
              }));
              if (err) console.error('Failed to sync monthly Contractor Invoice status from BOM PV:', err);
            }
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
    const validStatuses = ['PENDING_APPROVAL', 'APPROVED', 'SUBMITTED_TO_HO', 'PAID', 'REJECTED', 'CANCELLED'];
    if (!validStatuses.includes(status)) throw AppError.badRequest('INVALID_STATUS');
    const existing = await prisma.paymentVoucher.findUnique({ where: { id } });
    if (!existing) throw AppError.badRequest('VOUCHER_NOT_FOUND');

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
