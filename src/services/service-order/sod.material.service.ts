import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { InventoryRepository } from '@/repositories/inventory.repository';
import { ContractorRepository } from '@/repositories/contractor.repository';
import { MaterialRepository } from '@/repositories/material.repository';
import { MaterialUsageInput } from '@/types/service-order/sod-sync.types';
import { TransactionClient } from '@/types/inventory/inventory-service.types';
import { AuditLedgerService } from '@/services/inventory/audit-ledger.service';

export class SODMaterialService {
    /**
     * Check if a Service Order has manually entered or verified material usages (usageType != 'PORTAL_SYNC')
     */
    static async hasManualMaterial(serviceOrderId: string, tx?: TransactionClient): Promise<boolean> {
        const client = tx || prisma;
        const manualCount = await client.sODMaterialUsage.count({
            where: {
                serviceOrderId,
                usageType: { not: 'PORTAL_SYNC' }
            }
        });
        return manualCount > 0;
    }

    /**
     * Process and deduct material usage for an SOD
     */
    static async processMaterialUsage(
        tx: TransactionClient, 
        serviceOrderId: string,
        opmcId: string,
        contractorId: string | null,
        materialUsage: MaterialUsageInput[],
        inventoryService: {
            pickContractorBatchesFIFO: (tx: TransactionClient, contractorId: string, itemId: string, qty: number, allowShortage: boolean) => Promise<{ batchId: string | null; quantity: number; batch?: Record<string, unknown> | null }[]>;
            pickStoreBatchesFIFO: (tx: TransactionClient, storeId: string, itemId: string, qty: number, allowShortage: boolean) => Promise<{ batchId: string | null; quantity: number; batch?: Record<string, unknown> | null }[]>;
        },
        userId: string = 'SYSTEM'
    ) {
        // Serialize concurrent writers per SOD (the bridge push and an ERP-side sync
        // raced on AN202607230049085 and double-inserted a usage line). Transaction-
        // scoped advisory lock: re-entrant here, released automatically at commit.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${serviceOrderId}::text, 0))`;

        // Ground-truth defense: Never allow automated sync (BRIDGE_SYNC) to overwrite or rollback manually entered materials
        if (userId === 'BRIDGE_SYNC') {
            const hasManual = await this.hasManualMaterial(serviceOrderId, tx);
            if (hasManual) {
                console.log(`[SODMaterialService] Preserving existing manual material usage for ${serviceOrderId}: automated BRIDGE_SYNC processing bypassed.`);
                return { create: [] };
            }
        }

        // Essential for idempotency on re-patching
        await this.rollbackMaterialUsage(tx, serviceOrderId, userId);

        const finalUsageRecords: Prisma.SODMaterialUsageUncheckedCreateWithoutServiceOrderInput[] = [];
        const transactionItems: { itemId: string; batchId: string; quantity: number }[] = [];

        // Merge duplicate input lines (same item + usage type + serial) so a single
        // submission can never violate the uq_sod_material_usage_line DB guard.
        const mergedUsage = new Map<string, MaterialUsageInput>();
        for (const m of materialUsage) {
            const key = `${m.itemId}|${m.usageType}|${(m.serialNumber || '').trim()}`;
            const existing = mergedUsage.get(key);
            if (existing) {
                existing.quantity = String(parseFloat(existing.quantity || '0') + parseFloat(m.quantity || '0'));
            } else {
                mergedUsage.set(key, { ...m });
            }
        }

        // 1. Identify Source Store
        const opmc = await ContractorRepository.findOpmcWithStore(opmcId, tx);
        const storeId = opmc?.storeId;
        const hasActiveDeductions = materialUsage.some(m => parseFloat(m.quantity || '0') > 0);
        if (hasActiveDeductions && !contractorId && !storeId) throw AppError.badRequest('STORE_NOT_FOUND_FOR_OPMC');

        // 2. Process each material
        for (const m of mergedUsage.values()) {
            const qty = parseFloat(m.quantity || '0');
            if (qty <= 0) continue;

            const isDecrementingUsage = ['USED', 'WASTAGE', 'USED_F1', 'USED_G1', 'PORTAL_SYNC'].includes(m.usageType);
            
            // 2.1 Fetch Item Meta for validation
            const itemMeta = await InventoryRepository.findItemById(m.itemId, tx);
            if (!itemMeta) throw AppError.badRequest(`ITEM_NOT_FOUND: ${m.itemId}`);

            // 2.2 Serial Number validation
            if (itemMeta.hasSerial && !m.serialNumber && isDecrementingUsage) {
                throw AppError.badRequest(`SERIAL_REQUIRED_FOR_ITEM: ${itemMeta.name}`);
            }

            if (isDecrementingUsage) {
                // Completion is a custody and accounting event. Never create a usage
                // record for material that was not actually picked from a batch. A
                // shortage must fail the transaction so the SOD, stock and GL cannot
                // move into three different states.
                const allowShortage = false;
                const pickedBatches = contractorId 
                    ? await inventoryService.pickContractorBatchesFIFO(tx, contractorId, m.itemId, qty, allowShortage)
                    : await inventoryService.pickStoreBatchesFIFO(tx, storeId!, m.itemId, qty, allowShortage);

                const pickedQuantity = pickedBatches
                    .filter((picked) => picked.batchId !== null)
                    .reduce((sum, picked) => sum + picked.quantity, 0);
                const pickedForCost = pickedBatches.find((picked) => picked.batchId)?.batch as { costPrice?: number } | undefined;

                for (const picked of pickedBatches) {
                    const isShortage = picked.batchId === null;
                    
                    if (picked.batchId) {
                        if (contractorId) {
                            await ContractorRepository.updateBatchStock(contractorId, picked.batchId, -picked.quantity, tx);
                        } else {
                            await InventoryRepository.updateBatchStock(storeId!, picked.batchId, -picked.quantity, tx);
                        }
                        transactionItems.push({ itemId: m.itemId, batchId: picked.batchId, quantity: -picked.quantity });
                    }
                    
                    const record = this.mapToUsageRecord(m, picked.quantity, picked.batchId, isShortage ? itemMeta : picked.batch);
                    if (isShortage) {
                        record.exceedsLimit = true;
                        record.comment = `[AI_RECON] Material shortage detected: Sync requested ${qty} but stock was unavailable.`;
                    }
                    finalUsageRecords.push(record);
                }

                // Update Summary Stock (Global Stock for OPMC/Contractor)
                if (contractorId) {
                    await ContractorRepository.upsertStock(contractorId, m.itemId, -pickedQuantity, tx);
                } else {
                    const stockBefore = await InventoryRepository.findStock(storeId!, m.itemId, tx);
                    const stockAfter = await InventoryRepository.upsertStock(storeId!, m.itemId, -pickedQuantity, tx);
                    await AuditLedgerService.recordEntry({
                        storeId: storeId!,
                        itemId: m.itemId,
                        transactionType: 'SOD_INSTALLATION',
                        referenceType: 'SOD',
                        referenceId: serviceOrderId,
                        quantityBefore: Number(stockBefore?.quantity || 0),
                        quantityChange: -pickedQuantity,
                        quantityAfter: Number(stockAfter.quantity),
                        unitPrice: Number(pickedForCost?.costPrice || 0),
                        performedById: userId,
                        idempotencyKey: `SOD_MATERIAL_CONSUMPTION_${serviceOrderId}_${m.itemId}_${Date.now()}`,
                    }, tx);
                }

                // Update serial number status if the item is serialized
                if (itemMeta.hasSerial && m.serialNumber) {
                    const serialNum = m.serialNumber.trim();
                    await tx.inventoryItemSerial.update({
                        where: { serialNumber: serialNum },
                        data: {
                            status: m.usageType === 'WASTAGE' ? 'FAULTY' : 'INSTALLED',
                            storeId: null,
                            contractorId: null,
                            sodId: serviceOrderId
                        }
                    });
                }
            } else {
                // Return or Non-decrementing types
                finalUsageRecords.push(this.mapToUsageRecord(m, qty, null, itemMeta));
            }
        }

        // 3. Log Inventory Transaction (only for direct OPMC store usages, not for contractor stocks)
        if (transactionItems.length > 0 && !contractorId && storeId) {
            await InventoryRepository.createTransaction({
                type: 'TRANSFER_OUT',
                storeId: storeId,
                userId,
                referenceId: serviceOrderId,
                notes: `SOD Material Usage Update`,
                items: { create: transactionItems }
            }, tx);
        }

        return { create: finalUsageRecords };
    }

    /**
     * Map input to Prisma create record
     */
    private static mapToUsageRecord(m: MaterialUsageInput, qty: number, batchId: string | null, batchOrItem: { unit?: string; item?: { unit?: string }; costPrice?: string | number | null; unitPrice?: string | number | null } | null) {
        return {
            itemId: m.itemId,
            quantity: qty,
            usageType: m.usageType,
            unit: m.unit || batchOrItem?.unit || batchOrItem?.item?.unit || '',
            batchId: batchId,
            costPrice: batchOrItem?.costPrice ? Number(batchOrItem.costPrice) : 0,
            unitPrice: batchOrItem?.unitPrice ? Number(batchOrItem.unitPrice) : 0,
            wastagePercent: m.wastagePercent ? parseFloat(m.wastagePercent) : null,
            exceedsLimit: m.exceedsLimit || false,
            comment: m.comment || null,
            serialNumber: m.serialNumber || null
        };
    }

    /**
     * Rollback material usage for an SOD (Inventory Reversal)
     */
    static async rollbackMaterialUsage(tx: TransactionClient, serviceOrderId: string, userId: string = 'SYSTEM') {
        // Direct callers (RETURN flows, ledger rollbacks) mutate usage rows too - take
        // the same per-SOD lock. Re-entrant when already held by processMaterialUsage.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${serviceOrderId}::text, 0))`;

        const usage = await MaterialRepository.findByServiceOrderId(serviceOrderId, tx);
        if (usage.length === 0) return;

        const { contractorId, opmc } = usage[0].serviceOrder;
        const storeId = opmc?.storeId;
        const transactionItems: { itemId: string; batchId: string; quantity: number }[] = [];

        for (const m of usage) {
            const isDecrementingUsage = ['USED', 'WASTAGE', 'USED_F1', 'USED_G1', 'PORTAL_SYNC'].includes(m.usageType);
            if (!isDecrementingUsage) continue;

            const qty = Number(m.quantity);
            if (m.batchId) {
                if (contractorId) {
                    await ContractorRepository.updateBatchStock(contractorId, m.batchId, qty, tx);
                } else if (storeId) {
                    await InventoryRepository.updateBatchStock(storeId, m.batchId, qty, tx);
                }
                transactionItems.push({ itemId: m.itemId, batchId: m.batchId, quantity: qty });
            }

            // Restore Summary Stock
            if (contractorId) {
                await ContractorRepository.upsertStock(contractorId, m.itemId, qty, tx);
            } else if (storeId) {
                const stockBefore = await InventoryRepository.findStock(storeId, m.itemId, tx);
                const stockAfter = await InventoryRepository.upsertStock(storeId, m.itemId, qty, tx);
                await AuditLedgerService.recordEntry({
                    storeId,
                    itemId: m.itemId,
                    transactionType: 'STORE_TRANSFER_IN',
                    referenceType: 'SOD',
                    referenceId: serviceOrderId,
                    batchId: m.batchId,
                    quantityBefore: Number(stockBefore?.quantity || 0),
                    quantityChange: qty,
                    quantityAfter: Number(stockAfter.quantity),
                    unitPrice: Number(m.costPrice || 0),
                    performedById: userId,
                    idempotencyKey: `SOD_MATERIAL_REVERSAL_${m.id}`,
                }, tx);
            }

            // Restore serial number status
            if (m.serialNumber) {
                const serialNum = m.serialNumber.trim();
                await tx.inventoryItemSerial.update({
                    where: { serialNumber: serialNum },
                    data: {
                        status: contractorId ? 'ISSUED' : 'IN_STORE',
                        storeId: contractorId ? null : (storeId || null),
                        contractorId: contractorId || null,
                        sodId: null
                    }
                });
            }
        }

        if (transactionItems.length > 0 && !contractorId && storeId) {
            await InventoryRepository.createTransaction({
                type: 'TRANSFER_IN',
                storeId: storeId,
                userId,
                referenceId: serviceOrderId,
                notes: `Rollback SOD Material Usage`,
                items: { create: transactionItems }
            }, tx);
        }

        // Delete Usage Records
        await MaterialRepository.deleteMany({ serviceOrderId }, tx);
    }
}
