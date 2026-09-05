import { TransactionClient } from '@/types/inventory/inventory-service.types';
import { InventoryRepository } from '@/repositories/inventory.repository';
import { StockRequestRepository } from '@/repositories/stock-request.repository';

export interface ActionPayload {
    action: string;
    entityId: string;
    entityType: string;
    userId: string;
    instanceId?: string;
    metadata?: Record<string, unknown>;
    // Legacy support for older triggers
    stockReq?: Record<string, unknown>;
    items?: Record<string, unknown>[];
}

export class DomainActionDispatcher {
    /**
     * Dispatches a domain action to its respective handler.
     * Executes within the same Prisma transaction, ensuring automatic rollback on failure (Saga Pattern).
     * Uses IdempotencyLog to prevent duplicate executions (Oracle ERP standard).
     */
    static async dispatch(payload: ActionPayload, tx: TransactionClient) {
        const actionId = payload.action;
        const instanceId = payload.instanceId;

        if (instanceId) {
            const idempotencyKey = `${actionId}_${instanceId}`;
            const existingLog = await tx.idempotencyLog.findUnique({
                where: { idempotencyKey }
            });

            if (existingLog && existingLog.status === 'SUCCESS') {
                console.log(`[DomainActionDispatcher] Skipping duplicate action ${actionId} for instance ${instanceId}`);
                return; // Safely skip, already processed
            }

            await tx.idempotencyLog.upsert({
                where: { idempotencyKey },
                update: { status: 'SUCCESS' },
                create: { idempotencyKey, actionType: 'DOMAIN_ACTION', status: 'SUCCESS' }
            });
        }

        switch (actionId) {
            case 'TRIGGER_PROCUREMENT':
                await DomainActionDispatcher.handleTriggerProcurement(payload, tx);
                break;
            case 'POST_TO_LEDGER':
                await DomainActionDispatcher.handlePostToLedger(payload);
                break;
            case 'GENERATE_INVOICE':
                await DomainActionDispatcher.handleGenerateInvoice(payload);
                break;
            case 'PAY_CONTRACTOR':
                await DomainActionDispatcher.handlePayContractor(payload);
                break;
            case 'RETURN_MATERIAL':
                await DomainActionDispatcher.handleReturnMaterial(payload);
                break;
            case 'ACCRUE_WIP':
                await DomainActionDispatcher.handleAccrueWIP(payload, tx);
                break;
            case 'HANDLE_SOD_ASSIGNED':
                await DomainActionDispatcher.handleSodAssigned(payload, tx);
                break;
            case 'HANDLE_SOD_COMPLETED':
                await DomainActionDispatcher.handleSodCompleted(payload, tx);
                break;
            default:
                console.warn(`[DomainActionDispatcher] Unhandled domain action: ${actionId}`);
        }
    }

    private static async handleTriggerProcurement(payload: ActionPayload, tx: TransactionClient) {
        const { stockReq, items } = payload;
        
        if (!stockReq) return;

        interface LegacyItem {
            id: string;
            itemId: string;
            approvedQty?: number;
            requestedQty?: number;
        }

        const stockReqData = stockReq as { sourceType?: string; toStoreId?: string; items?: LegacyItem[] };
        const itemsData = (items as unknown as LegacyItem[]) || stockReqData.items;

        if (itemsData && Array.isArray(itemsData)) {
            for (const item of itemsData) {
                const finalApproved = (item.approvedQty && item.approvedQty > 0) ? item.approvedQty : (item.requestedQty || 0);
                await StockRequestRepository.updateItem(item.id, { approvedQty: finalApproved }, tx);
            }
        }

        if (stockReqData.sourceType === 'MAIN_STORE' && stockReqData.toStoreId) {
            // ATP: Reserve stock in the provider store (toStoreId)
            if (itemsData) {
                for (const item of itemsData) {
                    const qtyToReserve = item.approvedQty || item.requestedQty || 0;
                    if (qtyToReserve > 0) {
                        // This will throw if stock is insufficient, automatically rolling back the FSM state
                        await InventoryRepository.reserveStock(stockReqData.toStoreId, item.itemId, Number(qtyToReserve), tx);
                    }
                }
            }
        }
    }

    private static async handlePostToLedger(payload: ActionPayload) {
        console.log(`[DomainActionDispatcher] Stub: Posting to General Ledger for ${payload.entityType} ${payload.entityId}`);
        // TODO: Implement FinanceService.postLedgerEntry(payload.entityId, tx);
    }

    private static async handleGenerateInvoice(payload: ActionPayload) {
        console.log(`[DomainActionDispatcher] Stub: Generating Invoice for SOD ${payload.entityId}`);
        // TODO: Implement InvoiceService.generate(payload.entityId, tx);
    }

    private static async handlePayContractor(payload: ActionPayload) {
        console.log(`[DomainActionDispatcher] Stub: Paying Contractor for Invoice ${payload.entityId}`);
        // TODO: Implement ContractorPaymentService.process(payload.entityId, tx);
    }

    private static async handleReturnMaterial(payload: ActionPayload) {
        console.log(`[DomainActionDispatcher] Stub: Returning Material for SOD ${payload.entityId}`);
        // TODO: Implement SODMaterialService.returnDefectiveMaterials(payload.entityId, tx);
    }

    private static async handleAccrueWIP(payload: ActionPayload, tx: TransactionClient) {
        console.log(`[DomainActionDispatcher] Accruing WIP for completed SOD ${payload.entityId}`);
        const { LedgerService } = await import('@/services/finance/ledger.service');
        await LedgerService.accrueWipLiability(payload.entityId, tx);
    }
    // ==========================================
    // SOD Module Side-Effects (Zero-Hardcoded)
    // ==========================================

    private static async handleSodAssigned(payload: ActionPayload, tx: TransactionClient) {
        await DomainActionDispatcher.applySodStatus(payload, tx, 'INPROGRESS', 'GATE_APPROVED_ASSIGN');
    }

    private static async handleSodCompleted(payload: ActionPayload, tx: TransactionClient) {
        await DomainActionDispatcher.applySodStatus(payload, tx, 'COMPLETED', 'GATE_APPROVED_COMPLETE');
    }

    /**
     * Apply the status a cleared gate authorised.
     *
     * The status columns belong to the single SOD writer (defect O10). This handler used to write
     * `status` / `sltsStatus` / `statusDate` / `completedDate` itself and then insert its own history
     * row, which meant a gate-approved transition bypassed the authority policy, the duplicate
     * suppression and the `sod.status_changed` event. `skipGate` is required, not cosmetic: the gate
     * has already passed for this transition, and `startGate` would open a second instance for it.
     */
    private static async applySodStatus(payload: ActionPayload, tx: TransactionClient, status: string, reason: string) {
        const sod = await tx.serviceOrder.findUnique({
            where: { id: payload.entityId },
            select: { soNum: true, opmcId: true }
        });
        if (!sod) {
            console.warn(`[DomainActionDispatcher] ${reason}: SOD ${payload.entityId} not found, status write skipped`);
            return;
        }

        const { applySodStatus } = await import('@/services/service-order/sync/sod-status.writer');
        const now = new Date();
        const write = await applySodStatus({
            sodId: payload.entityId,
            soNum: sod.soNum ?? payload.entityId,
            opmcId: sod.opmcId,
            next: status === 'COMPLETED'
                ? { sltsStatus: status, status, completedDate: now }
                : { sltsStatus: status, status },
            anchor: now,
            actor: 'USER',
            reason,
            actorUserId: payload.userId,
            skipGate: true,
            tx,
        });

        console.log(`[DomainActionDispatcher] SOD ${write.soNum} ${reason}: ${write.changed ? 'applied' : `refused (${write.decision.reason})`}`);
    }

}
