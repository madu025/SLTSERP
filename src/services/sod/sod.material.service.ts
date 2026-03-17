/* eslint-disable @typescript-eslint/no-explicit-any */
import { Prisma } from '@prisma/client';
import { InventoryRepository } from '@/repositories/inventory.repository';
import { ContractorRepository } from '@/repositories/contractor.repository';
import { MaterialRepository } from '@/repositories/material.repository';
import { MaterialUsageInput } from './sod-types';
import { TransactionClient } from '../inventory/types';

export class SODMaterialService {
    /**
     * Process and deduct material usage for an SOD
     */
    static async processMaterialUsage(
        tx: TransactionClient, 
        serviceOrderId: string,
        opmcId: string,
        contractorId: string | null,
        materialUsage: MaterialUsageInput[],
        inventoryService: any,
        userId: string = 'SYSTEM'
    ) {
        // Essential for idempotency on re-patching
        await this.rollbackMaterialUsage(tx, serviceOrderId, userId);

        const finalUsageRecords: Prisma.SODMaterialUsageUncheckedCreateWithoutServiceOrderInput[] = [];
        const transactionItems: { itemId: string; batchId: string; quantity: number }[] = [];

        // 1. Identify Source Store
        const opmc = await ContractorRepository.findOpmcWithStore(opmcId, tx);
        const storeId = opmc?.storeId;
        if (!contractorId && !storeId) throw new Error('STORE_NOT_FOUND_FOR_OPMC');

        // 2. Process each material
        for (const m of materialUsage) {
            const qty = parseFloat(m.quantity || '0');
            if (qty <= 0) continue;

            const isDecrementingUsage = ['USED', 'WASTAGE', 'USED_F1', 'USED_G1'].includes(m.usageType);
            
            // 2.1 Fetch Item Meta for validation
            const itemMeta = await InventoryRepository.findItemById(m.itemId, tx);
            if (!itemMeta) throw new Error(`ITEM_NOT_FOUND: ${m.itemId}`);

            // 2.2 Serial Number validation
            if (itemMeta.hasSerial && !m.serialNumber && isDecrementingUsage) {
                throw new Error(`SERIAL_REQUIRED_FOR_ITEM: ${itemMeta.name}`);
            }

            if (isDecrementingUsage) {
                // If allowShortage is true in pick, it returns a null-batch record for the remainder
                const allowShortage = true; 
                const pickedBatches = contractorId 
                    ? await inventoryService.pickContractorBatchesFIFO(tx, contractorId, m.itemId, qty, allowShortage)
                    : await inventoryService.pickStoreBatchesFIFO(tx, storeId!, m.itemId, qty, allowShortage);

                for (const picked of pickedBatches) {
                    if (picked.batchId) {
                        if (contractorId) {
                            await ContractorRepository.updateBatchStock(contractorId, picked.batchId, -picked.quantity, tx);
                        } else {
                            await InventoryRepository.updateBatchStock(storeId!, picked.batchId, -picked.quantity, tx);
                        }
                        transactionItems.push({ itemId: m.itemId, batchId: picked.batchId, quantity: -picked.quantity });
                    }
                    
                    finalUsageRecords.push(this.mapToUsageRecord(m, picked.quantity, picked.batchId, picked.batch));
                }

                // Update Summary Stock (Global Stock for OPMC/Contractor)
                if (contractorId) {
                    await ContractorRepository.upsertStock(contractorId, m.itemId, -qty, tx);
                } else {
                    await InventoryRepository.upsertStock(storeId!, m.itemId, -qty, tx);
                }
            } else {
                // Return or Non-decrementing types
                finalUsageRecords.push(this.mapToUsageRecord(m, qty, null, itemMeta));
            }
        }

        // 3. Log Inventory Transaction
        if (transactionItems.length > 0) {
            await InventoryRepository.createTransaction({
                type: 'TRANSFER_OUT',
                storeId: storeId || undefined,
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
    private static mapToUsageRecord(m: MaterialUsageInput, qty: number, batchId: string | null, batch: any) {
        return {
            itemId: m.itemId,
            quantity: qty,
            usageType: m.usageType,
            unit: m.unit || batch?.item?.unit || '',
            batchId: batchId,
            costPrice: batch?.costPrice || 0,
            unitPrice: batch?.unitPrice || 0,
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
        const usage = await MaterialRepository.findByServiceOrderId(serviceOrderId, tx);
        if (usage.length === 0) return;

        const { contractorId, opmc } = usage[0].serviceOrder;
        const storeId = opmc?.storeId;
        const transactionItems: { itemId: string; batchId: string; quantity: number }[] = [];

        for (const m of usage) {
            const isDecrementingUsage = ['USED', 'WASTAGE', 'USED_F1', 'USED_G1'].includes(m.usageType);
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
                await InventoryRepository.upsertStock(storeId, m.itemId, qty, tx);
            }
        }

        if (transactionItems.length > 0) {
            await InventoryRepository.createTransaction({
                type: 'TRANSFER_IN',
                storeId: storeId || undefined,
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
