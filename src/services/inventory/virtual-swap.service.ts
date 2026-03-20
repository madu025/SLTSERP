
import { prisma } from '@/lib/prisma';
import { TransactionClient } from './types';

export class VirtualSwapService {

    /**
     * Get summary of SLT materials currently held by contractors
     */
    static async getTransitionSummary() {
        // 1. Find all items of type SLT that have commonName mapping to SLTS
        const sltItems = await prisma.inventoryItem.findMany({
            where: { type: 'SLT', commonName: { not: null } },
            select: { id: true, name: true, commonName: true, unit: true, code: true }
        });

        // 2. Fetch current contractor stocks for these items
        const stocks = await prisma.contractorStock.findMany({
            where: {
                itemId: { in: sltItems.map(i => i.id) },
                quantity: { gt: 0 }
            },
            include: {
                item: true,
                contractor: true
            }
        });

        // 3. Aggregate by commonName
        const summary: Record<string, { 
            commonName: string, 
            unit: string, 
            totalQty: number, 
            contractorCount: number,
            sltsItemId?: string 
        }> = {};

        for (const s of stocks) {
            const cName = s.item.commonName || s.item.name;
            if (!summary[cName]) {
                summary[cName] = { 
                    commonName: cName, 
                    unit: s.item.unit, 
                    totalQty: 0, 
                    contractorCount: 0 
                };
            }
            summary[cName].totalQty += s.quantity;
            summary[cName].contractorCount += 1;
        }

        // 4. Find matching SLTS items for these common names
        const sltsItems = await prisma.inventoryItem.findMany({
            where: { 
                type: 'SLTS', 
                commonName: { in: Object.keys(summary) } 
            },
            select: { id: true, commonName: true }
        });

        sltsItems.forEach(i => {
            if (i.commonName && summary[i.commonName]) {
                summary[i.commonName].sltsItemId = i.id;
            }
        });

        return Object.values(summary);
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
     * Perform the bulk virtual swap
     */
    static async executeBulkSwap(userId: string) {
        return await prisma.$transaction(async (tx: TransactionClient) => {
            // 1. Get all SLT items with commonName
            const mappingItems = await prisma.inventoryItem.findMany({
                where: { type: 'SLT', commonName: { not: null } }
            });

            // 2. For each mapping, find the SLTS counterpart
            const sltsItems = await prisma.inventoryItem.findMany({
                where: { type: 'SLTS', commonName: { in: mappingItems.map(i => i.commonName!) } }
            });

            const results = {
                contractorsProcessed: 0,
                itemsSwapped: 0,
                totalQtySwapped: 0
            };

            // 3. Process Contractor Stocks
            const contractorStocks = await tx.contractorStock.findMany({
                where: {
                    itemId: { in: mappingItems.map(i => i.id) },
                    quantity: { gt: 0 }
                },
                include: { item: true }
            });

            const processedContractors = new Set<string>();

            for (const stock of contractorStocks) {
                const targetSltsItem = sltsItems.find(i => i.commonName === stock.item.commonName);
                if (!targetSltsItem) continue;

                const qty = stock.quantity;

                // A. Deduct SLT Stock
                await tx.contractorStock.update({
                    where: { id: stock.id },
                    data: { quantity: 0 }
                });

                // B. Add SLTS Stock
                await tx.contractorStock.upsert({
                    where: { 
                        contractorId_itemId: { 
                            contractorId: stock.contractorId, 
                            itemId: targetSltsItem.id 
                        } 
                    },
                    update: { quantity: { increment: qty } },
                    create: { 
                        contractorId: stock.contractorId, 
                        itemId: targetSltsItem.id, 
                        quantity: qty 
                    }
                });

                // C. Log Transaction for Audit
                await tx.inventoryTransaction.create({
                    data: {
                        type: 'VIRTUAL_SWAP',
                        storeId: 'SYSTEM', // System wide virtual swap
                        userId: userId,
                        notes: `Virtual Swap: ${stock.item.name} (${qty}) -> ${targetSltsItem.name}`,
                        items: {
                            create: [
                                { itemId: stock.item.id, quantity: -qty },
                                { itemId: targetSltsItem.id, quantity: qty }
                            ]
                        }
                    }
                });

                processedContractors.add(stock.contractorId);
                results.itemsSwapped += 1;
                results.totalQtySwapped += qty;
            }

            results.contractorsProcessed = processedContractors.size;
            return results;
        }, { timeout: 30000 });
    }
}
