import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { TransactionClient } from '@/types/inventory/inventory-service.types';
import { assertProjectAccess } from '@/lib/project-access';
import { resolveOpmcScope } from '@/lib/opmc-scope';

export class InvoiceApprovalService {
    /**
     * Approves an invoice after apiHandler has enforced the DB-backed
     * finance.approve capability. Role names are intentionally not checked
     * here; organization-specific roles must be able to use the same policy.
     *
     * No GL posting happens here. Revenue / cost for an invoice is recognized
     * authoritatively earlier in the lifecycle (SOD completion accrual and
     * invoice generation), so posting again at approval would double-recognize
     * AR / revenue. Approval is purely a maker-checker status gate.
     */
    static async approveInvoice(invoiceId: string, actorId?: string | null) {
        await this.assertInvoiceScope(invoiceId, actorId);
        return await prisma.$transaction(async (tx: TransactionClient) => {
            const invoice = await tx.invoice.findUnique({
                where: { id: invoiceId },
                include: { contractor: true }
            });

            if (!invoice) throw AppError.notFound('Invoice not found');
            if (invoice.approvalStatus === 'APPROVED') throw AppError.badRequest('Invoice is already approved');

            // Update status only (GL already posted at generation/accrual).
            const updatedInvoice = await tx.invoice.update({
                where: { id: invoiceId },
                data: {
                    approvalStatus: 'APPROVED',
                    status: 'APPROVED' as import('@prisma/client').InvoiceStatus as import('@prisma/client').InvoiceStatus, // Assuming standard status is synced
                }
            });

            return updatedInvoice;
        });
    }

    static async rejectInvoice(invoiceId: string, reason: string, actorId?: string | null) {
        await this.assertInvoiceScope(invoiceId, actorId);
        return await prisma.invoice.update({
            where: { id: invoiceId },
            data: {
                approvalStatus: 'REJECTED',
                status: 'REJECTED' as import('@prisma/client').InvoiceStatus as import('@prisma/client').InvoiceStatus,
                description: reason
            }
        });
    }

    private static async assertInvoiceScope(invoiceId: string, actorId?: string | null) {
        if (!actorId) throw AppError.unauthorized('Authentication required');
        const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { projectId: true } });
        if (!invoice) throw AppError.notFound('Invoice not found');
        if (invoice.projectId) {
            await assertProjectAccess(invoice.projectId, actorId);
        } else if (await resolveOpmcScope(actorId) !== undefined) {
            throw AppError.forbidden('Unlinked invoice is outside assigned OPMC scope');
        }
    }
}
