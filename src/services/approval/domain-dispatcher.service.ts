import { TransactionClient } from '../inventory/types';
import { InventoryRepository } from '@/repositories/inventory.repository';
import { StockRequestRepository } from '@/repositories/stock-request.repository';

export interface ActionPayload {
    action: string;
    entityId: string;
    entityType: string;
    userId: string;
    instanceId?: string;
    metadata?: Record<string, any>;
    // Legacy support for older triggers
    stockReq?: any;
    items?: any;
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
                await this.handleTriggerProcurement(payload, tx);
                break;
            case 'POST_TO_LEDGER':
                await this.handlePostToLedger(payload, tx);
                break;
            case 'GENERATE_INVOICE':
                await this.handleGenerateInvoice(payload, tx);
                break;
            case 'PAY_CONTRACTOR':
                await this.handlePayContractor(payload, tx);
                break;
            case 'RETURN_MATERIAL':
                await this.handleReturnMaterial(payload, tx);
                break;
            case 'ACCRUE_WIP':
                await this.handleAccrueWIP(payload, tx);
                break;
            default:
                console.warn(`[DomainActionDispatcher] Unhandled domain action: ${actionId}`);
        }
    }

    private static async handleTriggerProcurement(payload: ActionPayload, tx: TransactionClient) {
        const { stockReq, items } = payload;
        
        if (!stockReq) return;

        if (items && Array.isArray(items)) {
            for (const item of items) {
                await StockRequestRepository.updateItem(item.id, { approvedQty: item.approvedQty || 0 }, tx);
            }
        }

        if (stockReq.sourceType === 'MAIN_STORE' && stockReq.toStoreId) {
            // ATP: Reserve stock in the provider store (toStoreId)
            for (const item of (items || stockReq.items)) {
                const qtyToReserve = item.approvedQty || item.requestedQty;
                if (qtyToReserve > 0) {
                    // This will throw if stock is insufficient, automatically rolling back the FSM state
                    await InventoryRepository.reserveStock(stockReq.toStoreId, item.itemId, Number(qtyToReserve), tx);
                }
            }
        }
    }

    private static async handlePostToLedger(payload: ActionPayload, tx: TransactionClient) {
        console.log(`[DomainActionDispatcher] Stub: Posting to General Ledger for ${payload.entityType} ${payload.entityId}`);
        // TODO: Implement FinanceService.postLedgerEntry(payload.entityId, tx);
    }

    private static async handleGenerateInvoice(payload: ActionPayload, tx: TransactionClient) {
        console.log(`[DomainActionDispatcher] Stub: Generating Invoice for SOD ${payload.entityId}`);
        // TODO: Implement InvoiceService.generate(payload.entityId, tx);
    }

    private static async handlePayContractor(payload: ActionPayload, tx: TransactionClient) {
        console.log(`[DomainActionDispatcher] Stub: Paying Contractor for Invoice ${payload.entityId}`);
        // TODO: Implement ContractorPaymentService.process(payload.entityId, tx);
    }

    private static async handleReturnMaterial(payload: ActionPayload, tx: TransactionClient) {
        console.log(`[DomainActionDispatcher] Stub: Returning Material for SOD ${payload.entityId}`);
        // TODO: Implement SODMaterialService.returnDefectiveMaterials(payload.entityId, tx);
    }

    private static async handleAccrueWIP(payload: ActionPayload, tx: TransactionClient) {
        console.log(`[DomainActionDispatcher] Accruing WIP for completed SOD ${payload.entityId}`);
        const { LedgerService } = await import('@/services/finance/ledger.service');
        await LedgerService.accrueWipLiability(payload.entityId, tx);
    }
}
