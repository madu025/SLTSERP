import { AppError } from '@/lib/error';
import { STAGE_DONE } from '@/lib/approval-chain-rules';
import type { TransactionClient } from '@/types/inventory/inventory-service.types';

/**
 * The domain action of the invoice gate (MARK_INVOICE_AREA_APPROVED): runs in the same transaction as the last approval. The invoice
 * is then area-approved and, since the contractor is one of the steps, also confirmed by its contractor, so it appears in the OSP
 * Quality (SF Audit) queue.
 */
export async function markInvoiceAreaApproved(tx: TransactionClient, input: { entityId: string; userId: string }) {
    const invoice = await tx.invoice.findUnique({ where: { id: input.entityId }, select: { id: true, invoiceNumber: true, status: true } });
    if (!invoice) throw AppError.notFound('Invoice not found');
    if (invoice.status === 'CANCELLED') throw AppError.badRequest('This invoice was cancelled');
    await tx.invoice.update({ where: { id: invoice.id }, data: { confirmStage: STAGE_DONE, contractorConfirmStatus: 'CONFIRMED', contractorConfirmedAt: new Date() } });
    await tx.auditLog.create({ data: { action: 'INVOICE_AREA_APPROVED', entity: 'Invoice', entityId: invoice.id, userId: input.userId, newValue: { invoiceNumber: invoice.invoiceNumber } } });
    return { invoiceNumber: invoice.invoiceNumber };
}
