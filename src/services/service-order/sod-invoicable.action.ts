import { AppError } from '@/lib/error';
import { validateSodForInvoicing } from '@/services/service-order/sod-financial-validation';
import { SOD_STAGE_DONE } from '@/lib/sod-approval-rules';
import type { TransactionClient } from '@/types/inventory/inventory-service.types';

/**
 * The domain action of the SOD invoicing gate (MARK_SOD_INVOICABLE). It runs in the same transaction as the last approval, so an
 * order that cannot be billed (no contractor, no completion date, no amounts, PAT incomplete, material without a cost) makes the
 * last approval fail and roll back instead of leaving an approved order that cannot be invoiced.
 */
export async function markSodInvoicable(tx: TransactionClient, input: { entityId: string; userId: string }) {
    const order = await tx.serviceOrder.findUnique({
        where: { id: input.entityId },
        select: {
            id: true, soNum: true, contractorId: true, completedDate: true, revenueAmount: true, contractorAmount: true,
            sltsPatStatus: true, opmcPatStatus: true, hoPatStatus: true, invoiced: true,
            materialUsage: { select: { quantity: true, unitPrice: true, costPrice: true } },
        },
    });
    if (!order) throw AppError.notFound('Service order not found');
    if (order.invoiced) throw AppError.badRequest('Already invoiced');
    const check = validateSodForInvoicing(order);
    if (!check.eligible) throw AppError.badRequest(`Cannot be billed yet: ${check.reasons.join(', ')}`);
    await tx.serviceOrder.update({ where: { id: order.id }, data: { isInvoicable: true, sodApprovalStage: SOD_STAGE_DONE } });
    await tx.auditLog.create({ data: { action: 'SOD_APPROVAL_COMPLETED', entity: 'ServiceOrder', entityId: order.id, userId: input.userId, newValue: { soNum: order.soNum } } });
    return { soNum: order.soNum };
}
