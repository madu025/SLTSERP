import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { TransactionClient } from '../inventory/types';

export class InvoiceApprovalService {
    /**
     * Approves an invoice, enforcing Maker-Checker rules based on amount.
     *
     * No GL posting happens here. Revenue / cost for an invoice is recognized
     * authoritatively earlier in the lifecycle (SOD completion accrual and
     * invoice generation), so posting again at approval would double-recognize
     * AR / revenue. Approval is purely a maker-checker status gate.
     */
    static async approveInvoice(invoiceId: string, approverId: string, approverRole: string) {
        return await prisma.$transaction(async (tx: TransactionClient) => {
            const invoice = await tx.invoice.findUnique({
                where: { id: invoiceId },
                include: { contractor: true }
            });

            if (!invoice) throw AppError.notFound('Invoice not found');
            if (invoice.approvalStatus === 'APPROVED') throw AppError.badRequest('Invoice is already approved');

            // Maker-Checker Logic
            // If amount > 1M LKR, requires SUPER_ADMIN. Otherwise FINANCE_MANAGER can approve.
            if (invoice.totalAmount > 1000000 && approverRole !== 'SUPER_ADMIN') {
                throw AppError.forbidden('Invoices over 1,000,000 LKR require SUPER_ADMIN approval.');
            }

            if (approverRole !== 'SUPER_ADMIN' && approverRole !== 'FINANCE_MANAGER') {
                throw AppError.forbidden('Insufficient permissions to approve invoices.');
            }

            // Update status only (GL already posted at generation/accrual).
            const updatedInvoice = await tx.invoice.update({
                where: { id: invoiceId },
                data: {
                    approvalStatus: 'APPROVED',
                    status: 'APPROVED', // Assuming standard status is synced
                }
            });

            return updatedInvoice;
        });
    }

    static async rejectInvoice(invoiceId: string, reason: string) {
        return await prisma.invoice.update({
            where: { id: invoiceId },
            data: {
                approvalStatus: 'REJECTED',
                status: 'REJECTED',
                description: reason
            }
        });
    }
}
