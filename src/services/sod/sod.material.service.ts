/* eslint-disable @typescript-eslint/no-explicit-any */
import { Prisma } from '@prisma/client';
import { InventoryRepository } from '@/repositories/inventory.repository';
import { ContractorRepository } from '@/repositories/contractor.repository';
import { MaterialRepository } from '@/repositories/material.repository';
import { MaterialUsageInput } from './sod-types';

export class SODMaterialService {
    /**
     * Process and deduct material usage for an SOD
     */
    static async processMaterialUsage(
        tx: any, 
        serviceOrderId: string,
        opmcId: string,
        contractorId: string | null,
        materialUsage: MaterialUsageInput[],
        inventoryService: any,
        userId: string = 'SYSTEM'
    ) {
        // ... (existing logic calling rollback)
        await this.rollbackMaterialUsage(tx, serviceOrderId, userId);
// ...

        // 1. Fetch material metadata
        const finalUsageRecords: Prisma.SODMaterialUsageUncheckedCreateWithoutServiceOrderInput[] = [];
        const transactionItems: { itemId: string; batchId: string; quantity: number }[] = [];

        // 2. Identify Source Store
        const opmc = await ContractorRepository.findOpmcWithStore(opmcId, tx);
        const storeId = opmc?.storeId;
        if (!contractorId && !storeId) throw new Error('STORE_NOT_FOUND_FOR_OPMC');

        // 3. Process each material
        for (const m of materialUsage) {
            const qty = parseFloat(m.quantity);
            const isDecrementingUsage = ['USED', 'WASTAGE', 'USED_F1', 'USED_G1'].includes(m.usageType);

            if (isDecrementingUsage) {
                const pickedBatches = contractorId 
                    ? await inventoryService.pickContractorBatchesFIFO(tx, contractorId, m.itemId, qty, true)
                    : await inventoryService.pickStoreBatchesFIFO(tx, storeId!, m.itemId, qty, true);

                for (const picked of pickedBatches) {
                    if (picked.batchId) {
                        if (contractorId) {
                            await ContractorRepository.updateBatchStock(contractorId, picked.batchId, -picked.quantity, tx);
                        } else {
                            await InventoryRepository.updateBatchStock(storeId!, picked.batchId, -picked.quantity, tx);
                        }
                    }
                    finalUsageRecords.push(this.mapToUsageRecord(m, picked.quantity, picked.batchId, picked.batch));
                }

                // Update Legacy/Summary Stock
                if (contractorId) {
                    await ContractorRepository.upsertStock(contractorId, m.itemId, -qty, tx);
                } else {
                    await InventoryRepository.upsertStock(storeId!, m.itemId, -qty, tx);
                }

                for (const picked of pickedBatches) {
                    if (picked.batchId) {
                        transactionItems.push({ itemId: m.itemId, batchId: picked.batchId, quantity: -picked.quantity });
                    }
                }
            } else {
                const itemMeta = await InventoryRepository.findItemById(m.itemId, tx);
                finalUsageRecords.push(this.mapToUsageRecord(m, qty, null, itemMeta));
            }
        }

        // 4. Log Transaction
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
     * Rollback material usage for an SOD
     */
    static async rollbackMaterialUsage(tx: any, serviceOrderId: string, userId: string = 'SYSTEM') {
        const usage = await MaterialRepository.findByServiceOrderId(serviceOrderId, tx);

        if (usage.length === 0) return;

        const { soNum, contractorId, opmc } = usage[0].serviceOrder;
        const storeId = opmc?.storeId;
        const transactionItems: { itemId: string; batchId: string; quantity: number }[] = [];

        for (const m of usage) {
            if (m.batchId) {
                if (contractorId) {
                    await ContractorRepository.updateBatchStock(contractorId, m.batchId, m.quantity, tx);
                    await ContractorRepository.upsertStock(contractorId, m.itemId, m.quantity, tx);
                } else if (storeId) {
                    await InventoryRepository.updateBatchStock(storeId, m.batchId, m.quantity, tx);
                    await InventoryRepository.upsertStock(storeId, m.itemId, m.quantity, tx);
                }
                transactionItems.push({ itemId: m.itemId, batchId: m.batchId, quantity: m.quantity });
            }
        }

        if (transactionItems.length > 0) {
            await InventoryRepository.createTransaction({
                type: 'TRANSFER_IN',
                storeId: storeId || undefined,
                userId,
                referenceId: serviceOrderId,
                notes: `SOD Material Rollback: ${soNum}`,
                items: { create: transactionItems }
            }, tx);
        }

        await MaterialRepository.deleteByServiceOrderId(serviceOrderId, tx);
    }

    private static mapToUsageRecord(
        input: MaterialUsageInput, 
        quantity: number, 
        batchId: string | null, 
        metadata: any
    ): Prisma.SODMaterialUsageUncheckedCreateWithoutServiceOrderInput {
        return {
            itemId: input.itemId,
            batchId: batchId,
            quantity: quantity,
            unit: input.unit || 'Nos',
            usageType: input.usageType || 'USED',
            unitPrice: metadata?.unitPrice || 0,
            costPrice: metadata?.costPrice || 0,
            wastagePercent: input.wastagePercent ? parseFloat(input.wastagePercent) : null,
            exceedsLimit: input.exceedsLimit || false,
            comment: input.comment,
            serialNumber: input.serialNumber
        };
    }
}
