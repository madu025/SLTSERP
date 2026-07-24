import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export interface StoreVarianceItemReport {
    storeId: string;
    storeName: string;
    itemId: string;
    itemCode: string;
    itemName: string;
    grnReceivedTotal: number;
    dispatchesTotal: number;
    returnsTotal: number;
    calculatedStock: number;
    physicalAuditedStock: number;
    varianceQuantity: number;
    unitCostLkr: number;
    varianceValueLkr: number;
    discrepancyStatus: 'BALANCED' | 'SURPLUS' | 'DEFICIT';
    riskSeverity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export class StoreVarianceReconciliationService {
    /**
     * Perform 3-Way Material Variance Audit for an Inventory Store
     * Calculated Stock = GRN Received - Dispatches + Returns - Wastage
     * Variance = Physical Audited Stock - Calculated Stock
     */
    static async generateStoreVarianceReport(storeId: string): Promise<StoreVarianceItemReport[]> {
        const store = await prisma.inventoryStore.findUnique({
            where: { id: storeId }
        });

        const storeName = store?.name || 'Unknown Store';

        // 1. Fetch Store Stock Items
        const stocks = await prisma.inventoryStock.findMany({
            where: { storeId },
            include: { item: true }
        });

        // 2. Fetch GRN Receipts for this store
        const grnItems = await prisma.gRNItem.findMany({
            where: {
                grn: { storeId }
            }
        });

        const grnTotalByItem = new Map<string, number>();
        for (const item of grnItems) {
            const current = grnTotalByItem.get(item.itemId) || 0;
            grnTotalByItem.set(item.itemId, current + item.quantity);
        }

        // 3. Fetch Dispatches to Contractors
        const issueItems = await prisma.contractorMaterialIssueItem.findMany({
            where: {
                issue: { storeId, status: 'ACCEPTED' }
            }
        });

        const dispatchTotalByItem = new Map<string, number>();
        for (const item of issueItems) {
            const current = dispatchTotalByItem.get(item.itemId) || 0;
            dispatchTotalByItem.set(item.itemId, current + item.quantity);
        }

        // 4. Fetch Returns
        const returnItems = await prisma.contractorMaterialReturnItem.findMany({
            where: {
                return: { storeId, status: 'ACCEPTED' }
            }
        });

        const returnTotalByItem = new Map<string, number>();
        for (const item of returnItems) {
            const current = returnTotalByItem.get(item.itemId) || 0;
            returnTotalByItem.set(item.itemId, current + item.quantity);
        }

        // 5. Build 3-Way Variance Matrix
        const reports: StoreVarianceItemReport[] = [];

        for (const stock of stocks) {
            const itemId = stock.itemId;
            const itemCode = stock.item.code;
            const itemName = stock.item.name;
            const unitCostLkr = stock.item.unitPrice ? Number(stock.item.unitPrice) : 500;

            const grnReceivedTotal = grnTotalByItem.get(itemId) || 0;
            const dispatchesTotal = dispatchTotalByItem.get(itemId) || 0;
            const returnsTotal = returnTotalByItem.get(itemId) || 0;

            const calculatedStock = grnReceivedTotal - dispatchesTotal + returnsTotal;
            const physicalAuditedStock = Number(stock.quantity);

            const varianceQuantity = physicalAuditedStock - calculatedStock;
            const varianceValueLkr = Math.round(varianceQuantity * unitCostLkr);

            let discrepancyStatus: 'BALANCED' | 'SURPLUS' | 'DEFICIT' = 'BALANCED';
            if (varianceQuantity < 0) discrepancyStatus = 'DEFICIT';
            else if (varianceQuantity > 0) discrepancyStatus = 'SURPLUS';

            const absVarianceVal = Math.abs(varianceValueLkr);
            let riskSeverity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
            if (absVarianceVal > 500000) riskSeverity = 'CRITICAL';
            else if (absVarianceVal > 100000) riskSeverity = 'HIGH';
            else if (absVarianceVal > 20000) riskSeverity = 'MEDIUM';

            reports.push({
                storeId,
                storeName,
                itemId,
                itemCode,
                itemName,
                grnReceivedTotal,
                dispatchesTotal,
                returnsTotal,
                calculatedStock,
                physicalAuditedStock,
                varianceQuantity,
                unitCostLkr,
                varianceValueLkr,
                discrepancyStatus,
                riskSeverity,
            });
        }

        return reports;
    }
}
