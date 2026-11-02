import { TransactionClient } from '@/types/inventory/inventory-service.types';
import { InventoryRepository } from '@/repositories/inventory.repository';
import { StockRequestRepository } from '@/repositories/stock-request.repository';
import { AppError } from '@/lib/error';
import { LedgerService } from '@/services/finance/ledger.service';
import { SODMaterialService } from '@/services/service-order/sod.material.service';
import { InvoiceGeneratorService } from '@/services/invoice/invoice.generator.service';

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
                update: { status: 'PROCESSING' },
                create: { idempotencyKey, actionType: 'DOMAIN_ACTION', status: 'PROCESSING' }
            });
        }

        let result: unknown;
        switch (actionId) {
            case 'TRIGGER_PROCUREMENT':
            case '/api/inventory/reserve-stock':
                result = await DomainActionDispatcher.handleTriggerProcurement(payload, tx);
                break;
            case 'POST_TO_LEDGER':
            case '/api/finance/post-ledger':
                result = await DomainActionDispatcher.handlePostToLedger(payload, tx);
                break;
            case 'GENERATE_INVOICE':
                result = await DomainActionDispatcher.handleGenerateInvoice(payload, tx);
                break;
            case 'PAY_CONTRACTOR':
            case '/api/finance/approve-payment':
                result = await DomainActionDispatcher.handlePayContractor(payload, tx);
                break;
            case 'RETURN_MATERIAL':
                result = await DomainActionDispatcher.handleReturnMaterial(payload, tx);
                break;
            case 'ACCRUE_WIP':
                result = await DomainActionDispatcher.handleAccrueWIP(payload, tx);
                break;
            case 'HANDLE_SOD_ASSIGNED':
                result = await DomainActionDispatcher.handleSodAssigned(payload, tx);
                break;
            case 'HANDLE_SOD_COMPLETED':
                result = await DomainActionDispatcher.handleSodCompleted(payload, tx);
                break;
            default:
                throw AppError.badRequest(`UNSUPPORTED_DOMAIN_ACTION: ${actionId}`);
        }

        if (instanceId) {
            await tx.idempotencyLog.update({
                where: { idempotencyKey: `${actionId}_${instanceId}` },
                data: { status: 'SUCCESS' }
            });
        }

        return result;
    }

    private static async handleTriggerProcurement(payload: ActionPayload, tx: TransactionClient) {
        interface LegacyItem {
            id: string;
            itemId: string;
            approvedQty?: number;
            requestedQty?: number;
        }

        const { stockReq, items } = payload;
        type ProcurementRequest = { sourceType?: string; toStoreId?: string | null; items?: LegacyItem[] };
        let stockReqData: ProcurementRequest;
        let itemsData: LegacyItem[] | undefined = items as unknown as LegacyItem[] | undefined;

        if (stockReq) {
            stockReqData = stockReq as ProcurementRequest;
            itemsData = itemsData || stockReqData.items;
        } else {
            // Process-gate actions do not carry the full request body. Resolve it
            // from the same transaction so a successful gate can never be treated
            // as a no-op just because the legacy payload shape was absent.
            const resolved = await tx.stockRequest.findUnique({
                where: { id: payload.entityId },
                select: {
                    sourceType: true,
                    toStoreId: true,
                    items: {
                        select: { id: true, itemId: true, approvedQty: true, requestedQty: true }
                    }
                }
            });
            if (!resolved) throw AppError.notFound('Material request not found');
            stockReqData = resolved as unknown as ProcurementRequest;
            itemsData = resolved.items as unknown as LegacyItem[];
        }

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

    private static async handlePostToLedger(payload: ActionPayload, tx: TransactionClient) {
        if (payload.entityType === 'SERVICE_ORDER' || payload.entityType === 'SOD') {
            return DomainActionDispatcher.handleSodLedger(payload, tx);
        }

        if (payload.entityType === 'PROJECT_INVOICE') {
            const invoice = await tx.projectInvoice.findUnique({
                where: { id: payload.entityId },
                select: { id: true, invoiceNumber: true, totalAmount: true, type: true, status: true }
            });
            if (!invoice) throw AppError.notFound('Project invoice not found');
            if (invoice.status !== 'ISSUED') {
                throw AppError.badRequest('PROJECT_INVOICE_MUST_BE_ISSUED_BEFORE_LEDGER_POSTING');
            }
            return LedgerService.logInvoiceIssuance(
                tx,
                invoice.id,
                Number(invoice.totalAmount),
                invoice.type,
                invoice.invoiceNumber,
                `Domain action ledger posting for ${invoice.invoiceNumber}`
            );
        }

        if (payload.entityType === 'INVOICE') {
            const invoice = await tx.invoice.findUnique({
                where: { id: payload.entityId },
                select: {
                    id: true,
                    invoiceNumber: true,
                    totalAmount: true,
                    amountA: true,
                    amountB: true,
                    vatAmount: true,
                    ssclAmount: true,
                }
            });
            if (!invoice) throw AppError.notFound('Contractor invoice not found');
            return LedgerService.logInvoiceGeneration(
                tx,
                invoice.id,
                invoice.invoiceNumber,
                Number(invoice.totalAmount),
                Number(invoice.amountA),
                Number(invoice.amountB),
                `Domain action ledger posting for ${invoice.invoiceNumber}`,
                Number(invoice.vatAmount),
                Number(invoice.ssclAmount)
            );
        }

        throw AppError.badRequest(`LEDGER_POSTING_NOT_SUPPORTED_FOR_ENTITY: ${payload.entityType}`);
    }

    private static async handleGenerateInvoice(payload: ActionPayload, tx: TransactionClient) {
        if (payload.entityType !== 'SERVICE_ORDER' && payload.entityType !== 'SOD') {
            throw AppError.badRequest(`INVOICE_GENERATION_NOT_SUPPORTED_FOR_ENTITY: ${payload.entityType}`);
        }

        const metadata = payload.metadata || {};
        const requestedIds = Array.isArray(metadata.sodIds)
            ? metadata.sodIds.filter((value): value is string => typeof value === 'string' && value.length > 0)
            : [];
        const sodIds = requestedIds.length > 0 ? [...new Set(requestedIds)] : [payload.entityId];
        const sods = await tx.serviceOrder.findMany({
            where: { id: { in: sodIds } },
            select: { id: true, contractorId: true, completedDate: true }
        });
        if (sods.length !== sodIds.length) {
            throw AppError.notFound('One or more SODs for invoice generation were not found');
        }

        const contractorIds = [...new Set(sods.map((sod) => sod.contractorId).filter(Boolean))] as string[];
        if (contractorIds.length !== 1) {
            throw AppError.badRequest('SOD_INVOICE_REQUIRES_ONE_CONTRACTOR');
        }
        if (metadata.contractorId && metadata.contractorId !== contractorIds[0]) {
            throw AppError.badRequest('SOD_INVOICE_CONTRACTOR_MISMATCH');
        }

        const completedDate = sods.find((sod) => sod.completedDate)?.completedDate || new Date();
        const monthValue = Number(metadata.month ?? completedDate.getUTCMonth() + 1);
        const yearValue = Number(metadata.year ?? completedDate.getUTCFullYear());
        if (!Number.isInteger(monthValue) || monthValue < 1 || monthValue > 12 || !Number.isInteger(yearValue)) {
            throw AppError.badRequest('SOD_INVOICE_PERIOD_REQUIRED');
        }

        return InvoiceGeneratorService.generateContractorMonthlyInvoice({
            contractorId: contractorIds[0],
            sodIds,
            month: monthValue,
            year: yearValue,
            description: typeof metadata.description === 'string' ? metadata.description : undefined,
            retentionPercent: typeof metadata.retentionPercent === 'number' ? metadata.retentionPercent : undefined,
            whtPercent: typeof metadata.whtPercent === 'number' ? metadata.whtPercent : undefined,
            advanceDeduction: typeof metadata.advanceDeduction === 'number' ? metadata.advanceDeduction : undefined,
        }, payload.userId, tx);
    }

    private static async handlePayContractor(payload: ActionPayload, tx: TransactionClient) {
        // Direct payment is deliberately not an approval-gate side effect. The
        // PaymentVoucher maker/checker flow requires a separate voucher, bank
        // evidence and a different actor for approval/payment.
        void payload;
        void tx;
        throw AppError.badRequest('DIRECT_CONTRACTOR_PAYMENT_DISABLED_USE_PAYMENT_VOUCHER_WORKFLOW');
    }

    private static async handleReturnMaterial(payload: ActionPayload, tx: TransactionClient) {
        if (payload.entityType !== 'SERVICE_ORDER' && payload.entityType !== 'SOD') {
            throw AppError.badRequest(`MATERIAL_RETURN_NOT_SUPPORTED_FOR_ENTITY: ${payload.entityType}`);
        }
        const sod = await tx.serviceOrder.findUnique({
            where: { id: payload.entityId },
            select: { id: true, sltsStatus: true }
        });
        if (!sod) throw AppError.notFound('SOD not found');
        if (sod.sltsStatus !== 'RETURN' && payload.metadata?.targetStatus !== 'RETURN') {
            throw AppError.badRequest('SOD_MUST_BE_RETURNING_BEFORE_MATERIAL_ROLLBACK');
        }
        await SODMaterialService.rollbackMaterialUsage(tx, sod.id, payload.userId || 'SYSTEM');
        await LedgerService.rollbackSodTransaction(tx, sod.id, `Domain action material rollback for SOD ${sod.id}`);
        return { sodId: sod.id, materialRolledBack: true };
    }

    private static async handleAccrueWIP(payload: ActionPayload, tx: TransactionClient) {
        await LedgerService.accrueWipLiability(payload.entityId, tx);
        return { sodId: payload.entityId, wipAccrued: true };
    }

    private static async handleSodLedger(payload: ActionPayload, tx: TransactionClient) {
        const sod = await tx.serviceOrder.findUnique({
            where: { id: payload.entityId },
            select: { id: true, sltsStatus: true, revenueAmount: true, contractorAmount: true, contractorId: true }
        });
        if (!sod) throw AppError.notFound('SOD not found');
        if (!['COMPLETED', 'INSTALL_CLOSED', 'PROV_CLOSED'].includes(sod.sltsStatus)) {
            throw AppError.badRequest('SOD_MUST_BE_COMPLETED_BEFORE_LEDGER_POSTING');
        }

        const costRows = await tx.$queryRaw<Array<{ total: string | number | null }>>`
            SELECT fn_sod_total_material_cost(${sod.id}::uuid) as total
        `;
        const materialCost = Number(costRows[0]?.total || 0);
        await LedgerService.logSodConsumption(tx, sod.id, materialCost);
        if (sod.revenueAmount) {
            await LedgerService.logSodRevenue(tx, sod.id, Number(sod.revenueAmount));
        }
        if (sod.contractorAmount) {
            const contractor = sod.contractorId
                ? await tx.contractor.findUnique({ where: { id: sod.contractorId }, select: { name: true } })
                : null;
            await LedgerService.logContractorAccrual(tx, sod.id, Number(sod.contractorAmount), contractor?.name || 'Unknown Contractor');
        }
        return { sodId: sod.id, materialCost, ledgerPosted: true };
    }
    // ==========================================
    // SOD Module Side-Effects (Zero-Hardcoded)
    // ==========================================

    private static async handleSodAssigned(payload: ActionPayload, tx: TransactionClient) {
        return DomainActionDispatcher.applySodStatus(payload, tx, 'INPROGRESS', 'GATE_APPROVED_ASSIGN');
    }

    private static async handleSodCompleted(payload: ActionPayload, tx: TransactionClient) {
        const write = await DomainActionDispatcher.applySodStatus(payload, tx, 'COMPLETED', 'GATE_APPROVED_COMPLETE');
        if (write.changed) {
            await DomainActionDispatcher.handleSodLedger(payload, tx);
        }
        return write;
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
            throw AppError.notFound(`SOD ${payload.entityId} not found for ${reason}`);
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

        if (!write.changed && write.decision.reason !== 'NO_CHANGE') {
            throw AppError.badRequest(`SOD_STATUS_TRANSITION_REJECTED: ${write.decision.reason}`);
        }
        return write;
    }

}
