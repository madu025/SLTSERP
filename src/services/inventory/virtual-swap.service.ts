
import { prisma } from '@/lib/prisma';
import { TransactionClient } from './types';

export class VirtualSwapService {

    /**
     * Get summary of SLT materials currently held by contractors, 
     * including those that cannot be automatically mapped.
     */
    static async getTransitionSummary() {
        // 1. Fetch all contractor stocks of type SLT
        const stocks = await prisma.contractorStock.findMany({
            where: {
                item: { type: 'SLT' },
                quantity: { gt: 0 }
            },
            include: {
                item: true,
                contractor: { select: { name: true } }
            }
        });

        // 2. Aggregation map
        const summary: Record<string, { 
            commonName: string, 
            unit: string, 
            totalQty: number, 
            contractorCount: number,
            sltsItemId?: string,
            isMappable: boolean
        }> = {};

        // 3. Identification of potential SLTS matches
        const allCommonNames = Array.from(new Set(stocks.map(s => s.item.commonName).filter(Boolean))) as string[];
        
        const sltsMatches = await prisma.inventoryItem.findMany({
            where: { 
                type: 'SLTS', 
                commonName: { in: allCommonNames } 
            },
            select: { id: true, commonName: true }
        });

        for (const s of stocks) {
            const cName = s.item.commonName || s.item.name;
            if (!summary[cName]) {
                const match = sltsMatches.find(m => m.commonName === s.item.commonName);
                summary[cName] = { 
                    commonName: cName, 
                    unit: s.item.unit, 
                    totalQty: 0, 
                    contractorCount: 0,
                    sltsItemId: match?.id,
                    isMappable: !!match
                };
            }
            summary[cName].totalQty += s.quantity;
            summary[cName].contractorCount += 1;
        }

        return Object.values(summary);
    }

    /**
     * Get detailed preview of exactly what will be swapped
     */
    static async getTransitionPreview() {
        // 1. Fetch all SLT items that have SLTS counterparts
        const sltItems = await prisma.inventoryItem.findMany({
            where: { type: 'SLT', commonName: { not: null } }
        });

        const sltsItems = await prisma.inventoryItem.findMany({
            where: { type: 'SLTS', commonName: { in: sltItems.map(i => i.commonName!) } }
        });

        // 2. Fetch all contractor stocks for these mappable items
        const stocks = await prisma.contractorStock.findMany({
            where: {
                itemId: { in: sltItems.map(i => i.id) },
                quantity: { gt: 0 }
            },
            include: {
                item: true,
                contractor: { select: { name: true, opmc: { select: { name: true } } } }
            }
        });

        return stocks.map(s => {
            const target = sltsItems.find(i => i.commonName === s.item.commonName);
            return {
                contractorName: s.contractor.name,
                opmcName: s.contractor.opmc?.name || 'N/A',
                fromItem: s.item.name,
                fromCode: s.item.code,
                toItem: target?.name || 'MISSING MAPPING',
                toCode: target?.code || 'N/A',
                quantity: s.quantity,
                unit: s.item.unit,
                isMappable: !!target
            };
        });
    }

    /**
     * Get detailed in-hand stock per contractor and material
     */
    static async getInHandStock(filters: { contractorId?: string, itemId?: string }) {
        const stocks = await prisma.contractorStock.findMany({
            where: {
                ...(filters.contractorId ? { contractorId: filters.contractorId } : {}),
                ...(filters.itemId ? { itemId: filters.itemId } : {}),
                quantity: { gt: 0 }
            },
            include: {
                item: { select: { code: true, name: true, unit: true, type: true } },
                contractor: { select: { name: true, opmc: { select: { name: true } } } }
            },
            orderBy: [
                { contractor: { name: 'asc' } },
                { item: { name: 'asc' } }
            ]
        });

        return stocks.map(s => ({
            id: s.id,
            contractorName: s.contractor.name,
            opmcName: s.contractor.opmc?.name || 'N/A',
            itemCode: s.item.code,
            itemName: s.item.name,
            itemType: s.item.type,
            unit: s.item.unit,
            quantity: s.quantity
        }));
    }

    /**
     * Perform the bulk virtual swap with batch-level conversion
     */
    static async executeBulkSwap(userId: string) {
        return await prisma.$transaction(async (tx: TransactionClient) => {
            // 1. Identification: Map SLT items to SLTS counterparts
            const sltItems = await tx.inventoryItem.findMany({
                where: { type: 'SLT', commonName: { not: null } }
            });

            const sltsItems = await tx.inventoryItem.findMany({
                where: { type: 'SLTS', commonName: { in: sltItems.map(i => i.commonName!) } }
            });

            const results = {
                contractorsProcessed: 0,
                itemsSwapped: 0,
                totalQtySwapped: 0
            };

            const processedContractors = new Set<string>();

            // 2. Main Logic: Iterate through all contractor batches of type SLT
            const currentBatches = await tx.contractorBatchStock.findMany({
                where: {
                    item: { type: 'SLT', commonName: { not: null } },
                    quantity: { gt: 0 }
                },
                include: { item: true }
            });

            for (const cbs of currentBatches) {
                const targetSltsItem = sltsItems.find(i => i.commonName === cbs.item.commonName);
                if (!targetSltsItem) continue;

                const qty = cbs.quantity;

                const vtBatchNumber = `VT-${targetSltsItem.code}`;
                let vtBatch = await tx.inventoryBatch.findFirst({
                    where: { batchNumber: vtBatchNumber, itemId: targetSltsItem.id }
                });

                if (!vtBatch) {
                    vtBatch = await tx.inventoryBatch.create({
                        data: {
                            batchNumber: vtBatchNumber,
                            itemId: targetSltsItem.id,
                            initialQty: 0,
                            costPrice: cbs.item.costPrice || 0,
                            unitPrice: cbs.item.unitPrice || 0
                        }
                    });
                }

                await tx.contractorBatchStock.update({
                    where: { id: cbs.id },
                    data: { quantity: 0 }
                });

                await tx.contractorBatchStock.upsert({
                    where: { 
                        contractorId_batchId: { 
                            contractorId: cbs.contractorId, 
                            batchId: vtBatch.id 
                        } 
                    },
                    update: { quantity: { increment: qty } },
                    create: { 
                        contractorId: cbs.contractorId, 
                        batchId: vtBatch.id,
                        itemId: targetSltsItem.id,
                        quantity: qty 
                    }
                });

                await tx.contractorStock.updateMany({
                    where: { contractorId: cbs.contractorId, itemId: cbs.item.id },
                    data: { quantity: { decrement: qty } }
                });

                await tx.contractorStock.upsert({
                    where: { 
                        contractorId_itemId: { 
                            contractorId: cbs.contractorId, 
                            itemId: targetSltsItem.id 
                        } 
                    },
                    update: { quantity: { increment: qty } },
                    create: { 
                        contractorId: cbs.contractorId, 
                        itemId: targetSltsItem.id, 
                        quantity: qty 
                    }
                });

                processedContractors.add(cbs.contractorId);
                results.itemsSwapped += 1;
                results.totalQtySwapped += qty;

                await tx.inventoryTransaction.create({
                    data: {
                        type: 'VIRTUAL_SWAP',
                        storeId: 'SYSTEM',
                        userId: userId,
                        notes: `Batch Swap: ${cbs.item.name} (${qty}) -> ${targetSltsItem.name}`,
                        items: {
                            create: [
                                { itemId: cbs.item.id, quantity: -qty, batchId: cbs.batchId },
                                { itemId: targetSltsItem.id, quantity: qty, batchId: vtBatch.id }
                            ]
                        }
                    }
                });
            }

            results.contractorsProcessed = processedContractors.size;
            return results;
        }, { timeout: 60000 });
    }
}
