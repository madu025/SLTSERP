import { Prisma } from '@prisma/client';
import { TransactionClient, PickedBatch } from '../inventory/types';
import { MaterialUsageInput } from './sod-types';

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
        inventoryService: { 
            pickContractorBatchesFIFO: (tx: TransactionClient, contractorId: string, itemId: string, qty: number, allowShortage: boolean) => Promise<PickedBatch[]>;
            pickStoreBatchesFIFO: (tx: TransactionClient, storeId: string, itemId: string, qty: number, allowShortage: boolean) => Promise<PickedBatch[]>;
        },
        userId: string = 'SYSTEM'
    ) {
        // 0. Rollback existing usage to ensure stock integrity on update
        await this.rollbackMaterialUsage(tx, serviceOrderId, userId);

        // 1. Fetch material metadata to snapshot prices
        const itemIds = materialUsage.map((m) => m.itemId);
        const itemMetadata = await tx.inventoryItem.findMany({
            where: { id: { in: itemIds } },
            select: { id: true, unitPrice: true, costPrice: true }
        });

        const finalUsageRecords: Prisma.SODMaterialUsageUncheckedCreateWithoutServiceOrderInput[] = [];
        const transactionItems: { itemId: string; batchId: string; quantity: number }[] = [];

        // 2. Identify Source (Store or Contractor)
        let storeId: string | null = null;
        if (!contractorId) {
            const opmc = await tx.oPMC.findUnique({
                where: { id: opmcId },
                select: { storeId: true }
            });
            storeId = opmc?.storeId || null;
            if (!storeId) throw new Error('STORE_NOT_FOUND_FOR_OPMC');
        }

        // 3. Process each material
        for (const m of materialUsage) {
            const qty = parseFloat(m.quantity);
            const isDecrementingUsage = ['USED', 'WASTAGE', 'USED_F1', 'USED_G1'].includes(m.usageType);

            if (isDecrementingUsage) {
                const pickedBatches = contractorId 
                    ? await inventoryService.pickContractorBatchesFIFO(tx, contractorId, m.itemId, qty, true)
                    : await inventoryService.pickStoreBatchesFIFO(tx, storeId!, m.itemId, qty, true);

                for (const picked of pickedBatches) {
                    // Reduce Stock
                    if (picked.batchId) {
                        if (contractorId) {
                            await tx.contractorBatchStock.update({
                                where: { contractorId_batchId: { contractorId, batchId: picked.batchId } },
                                data: { quantity: { decrement: picked.quantity } }
                            });
                        } else {
                            await tx.inventoryBatchStock.update({
                                where: { storeId_batchId: { storeId: storeId!, batchId: picked.batchId } },
                                data: { quantity: { decrement: picked.quantity } }
                            });
                        }
                    }

                    // Prepare Usage Record
                    finalUsageRecords.push(this.mapToUsageRecord(m, picked.quantity, picked.batchId, picked.batch));
                }

                // Update Legacy Stock
                if (contractorId) {
                    await tx.contractorStock.upsert({
                        where: { contractorId_itemId: { contractorId, itemId: m.itemId } },
                        create: { contractorId, itemId: m.itemId, quantity: -qty },
                        update: { quantity: { decrement: qty } }
                    });
                } else {
                    await tx.inventoryStock.upsert({
                        where: { storeId_itemId: { storeId: storeId!, itemId: m.itemId } },
                        create: { storeId: storeId!, itemId: m.itemId, quantity: -qty },
                        update: { quantity: { decrement: qty } }
                    });
                }

                // Collect for transaction log
                for (const picked of pickedBatches) {
                    if (picked.batchId) {
                        transactionItems.push({ itemId: m.itemId, batchId: picked.batchId, quantity: -picked.quantity });
                    }
                }
            } else {
                // Non-decrementing usage (e.g. RECORD ONLY) or fallback
                const meta = itemMetadata.find(i => i.id === m.itemId);
                finalUsageRecords.push(this.mapToUsageRecord(m, qty, null, meta));
            }
        }

        // 4. Log Transaction for Transparency
        if (transactionItems.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (tx as any).inventoryTransaction.create({
                data: {
                    type: 'TRANSFER_OUT',
                    storeId: storeId || undefined,
                    userId,
                    referenceId: serviceOrderId,
                    notes: `SOD Material Usage Update`,
                    items: {
                        create: transactionItems
                    }
                }
            });
        }

        // 5. Update Database
        return {
            create: finalUsageRecords
        };
    }

    /**
     * Rollback material usage for an SOD (e.g. on Cancel/Return)
     * Reinstates stock to original batches and records transparency log.
     */
    static async rollbackMaterialUsage(tx: TransactionClient, serviceOrderId: string, userId: string = 'SYSTEM') {
        const usage = await tx.sODMaterialUsage.findMany({
            where: { serviceOrderId },
            include: {
                serviceOrder: {
                    select: {
                        soNum: true,
                        contractorId: true,
                        opmc: { select: { storeId: true } }
                    }
                }
            }
        });

        if (usage.length === 0) return;

        const { soNum, contractorId, opmc } = usage[0].serviceOrder;
        const storeId = opmc?.storeId;

        const transactionItems: { itemId: string; batchId: string; quantity: number }[] = [];

        for (const m of usage) {
            const qty = m.quantity;
            
            // A. Update Batch Stock (If applicable)
            if (m.batchId) {
                if (contractorId) {
                    await tx.contractorBatchStock.upsert({
                        where: { contractorId_batchId: { contractorId, batchId: m.batchId } },
                        update: { quantity: { increment: qty } },
                        create: { contractorId, batchId: m.batchId, itemId: m.itemId, quantity: qty }
                    });
                } else if (storeId) {
                    await tx.inventoryBatchStock.upsert({
                        where: { storeId_batchId: { storeId, batchId: m.batchId } },
                        update: { quantity: { increment: qty } },
                        create: { storeId, batchId: m.batchId, itemId: m.itemId, quantity: qty }
                    });
                }
                transactionItems.push({ itemId: m.itemId, batchId: m.batchId, quantity: qty });
            }

            // B. Update Global Stock
            if (contractorId) {
                await tx.contractorStock.upsert({
                    where: { contractorId_itemId: { contractorId, itemId: m.itemId } },
                    update: { quantity: { increment: qty } },
                    create: { contractorId, itemId: m.itemId, quantity: qty }
                });
            } else if (storeId) {
                await tx.inventoryStock.upsert({
                    where: { storeId_itemId: { storeId, itemId: m.itemId } },
                    update: { quantity: { increment: qty } },
                    create: { storeId, itemId: m.itemId, quantity: qty }
                });
            }
        }

        // 2. Log Transaction for Transparency
        if (transactionItems.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (tx as any).inventoryTransaction.create({
                data: {
                    type: 'TRANSFER_IN',
                    storeId: storeId || undefined,
                    userId,
                    referenceId: serviceOrderId,
                    notes: `SOD Material Rollback: ${soNum}`,
                    items: {
                        create: transactionItems
                    }
                }
            });
        }

        // 3. Clear usage records
        await tx.sODMaterialUsage.deleteMany({ where: { serviceOrderId } });
    }

    private static mapToUsageRecord(
        input: MaterialUsageInput, 
        quantity: number, 
        batchId: string | null, 
        metadata: { unitPrice?: number | null; costPrice?: number | null } | null | undefined
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
