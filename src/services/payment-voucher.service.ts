import { prisma } from '@/lib/prisma';

interface CreateVoucherInput {
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
    retentionAmount?: number;
    retentionReleaseId?: string | null;
    notes?: string | null;
    createdById?: string | null;
}

interface UpdateVoucherStatusOptions {
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
     * Get list of payment vouchers
     */
    static async getVouchers(projectId: string) {
        const vouchers = await prisma.paymentVoucher.findMany({
            where: { projectId },
            include: {
                invoice: {
                    select: { invoiceNumber: true, title: true, totalAmount: true }
                }
            },
            orderBy: { createdAt: 'desc' },
        });
        return vouchers;
    }

    /**
     * Create a new payment voucher
     */
    static async createVoucher(data: CreateVoucherInput) {
        const {
            projectId, title, description, type, payeeName, payeeId,
            invoiceId, amount, paymentDate, paymentMethod, bankName,
            bankBranch, accountNumber, chequeNumber, referenceNumber,
            taxWithheld, retentionAmount, retentionReleaseId, notes, createdById,
        } = data;

        // Auto-generate PV number
        const lastPV = await prisma.paymentVoucher.findFirst({
            orderBy: { pvNumber: 'desc' },
            select: { pvNumber: true },
        });

        let nextNumber: string;
        if (lastPV && lastPV.pvNumber) {
            const lastNum = parseInt(lastPV.pvNumber.replace('PV-', ''), 10);
            const nextNum = isNaN(lastNum) ? 1 : lastNum + 1;
            nextNumber = 'PV-' + String(nextNum).padStart(5, '0');
        } else {
            nextNumber = 'PV-00001';
        }

        const tax = taxWithheld || 0;
        const retention = retentionAmount || 0;
        const netAmount = amount - tax - retention;

        const voucher = await prisma.paymentVoucher.create({
            data: {
                pvNumber: nextNumber,
                projectId,
                title,
                description: description || null,
                type: type || 'CONTRACTOR',
                payeeName,
                payeeId: payeeId || null,
                invoiceId: invoiceId || null,
                amount,
                paymentDate: paymentDate ? new Date(paymentDate) : null,
                paymentMethod: paymentMethod || null,
                bankName: bankName || null,
                bankBranch: bankBranch || null,
                accountNumber: accountNumber || null,
                chequeNumber: chequeNumber || null,
                referenceNumber: referenceNumber || null,
                taxWithheld: tax,
                retentionAmount: retention,
                netAmount,
                retentionReleaseId: retentionReleaseId || null,
                notes: notes || null,
                createdById: createdById || null,
                status: 'DRAFT',
            },
            include: { invoice: true },
        });

        return voucher;
    }

    /**
     * Update PV status and handle transaction cascades
     */
    static async updateVoucherStatus(id: string, status: string, options: UpdateVoucherStatusOptions) {
        const voucher = await prisma.$transaction(async (tx) => {
            const existing = await tx.paymentVoucher.findUnique({ where: { id } });
            if (!existing) {
                throw new Error('PAYMENT_VOUCHER_NOT_FOUND');
            }

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

        return voucher;
    }

    /**
     * Delete payment voucher (DRAFT only)
     */
    static async deleteVoucher(id: string) {
        const existing = await prisma.paymentVoucher.findUnique({ where: { id } });
        if (!existing) {
            throw new Error('PAYMENT_VOUCHER_NOT_FOUND');
        }

        if (existing.status !== 'DRAFT') {
            throw new Error('DRAFT_ONLY_DELETION');
        }

        await prisma.paymentVoucher.delete({ where: { id } });
        return { success: true };
    }
}
