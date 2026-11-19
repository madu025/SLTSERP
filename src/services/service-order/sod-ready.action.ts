import { AppError } from '@/lib/error';
import { SOD_STAGE_READY } from '@/lib/sod-approval-rules';
import type { TransactionClient } from '@/types/inventory/inventory-service.types';

/**
 * The domain action of the order gate (MARK_SOD_READY_FOR_INVOICE). It runs in the same transaction as the last approval: the order is
 * now ready for the engineer of its area to put on an invoice. The financial check (PAT, amounts, material costs) happens when the
 * engineer creates the invoice, where its reasons can be shown against the order.
 */
export async function markSodReadyForInvoice(tx: TransactionClient, input: { entityId: string; userId: string }) {
    const order = await tx.serviceOrder.findUnique({ where: { id: input.entityId }, select: { id: true, soNum: true, invoiced: true } });
    if (!order) throw AppError.notFound('Service order not found');
    if (order.invoiced) throw AppError.badRequest('Already invoiced');
    await tx.serviceOrder.update({ where: { id: order.id }, data: { sodApprovalStage: SOD_STAGE_READY, invoicingHeldAt: null, invoicingHoldReason: null } });
    await tx.auditLog.create({ data: { action: 'SOD_READY_FOR_INVOICE', entity: 'ServiceOrder', entityId: order.id, userId: input.userId, newValue: { soNum: order.soNum } } });
    return { soNum: order.soNum };
}
