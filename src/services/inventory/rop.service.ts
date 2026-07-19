import { prisma } from '@/lib/prisma';

export class ROPService {
    /**
     * Calculate and update Reorder Points (ROP) and Safety Stocks for all active inventory items.
     * Uses consumption (usages) and procurement lead times over the past 90 days.
     */
    static async updateDynamicSafetyLevels() {
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        // 1. Fetch all items
        const items = await prisma.inventoryItem.findMany({
            select: { id: true, code: true, name: true, minLevel: true }
        });

        // 2. Pre-fetch usages for all items in a single query
        const allUsages = await prisma.sODMaterialUsage.findMany({
            where: {
                createdAt: { gte: ninetyDaysAgo },
                usageType: { in: ['USED', 'USED_F1', 'USED_G1', 'PORTAL_SYNC', 'WASTAGE'] }
            },
            select: { itemId: true, quantity: true, createdAt: true }
        });

        // Group usages by itemId
        const usageMap = new Map<string, Array<{ quantity: number; createdAt: Date }>>();
        for (const u of allUsages) {
            if (u.itemId) {
                const list = usageMap.get(u.itemId) || [];
                list.push({ quantity: u.quantity, createdAt: u.createdAt });
                usageMap.set(u.itemId, list);
            }
        }

        // 3. Pre-fetch stock requests for all items in a single query
        const allRequests = await prisma.stockRequest.findMany({
            where: {
                receivedDate: { not: null },
                createdAt: { gte: ninetyDaysAgo }
            },
            select: {
                createdAt: true,
                receivedDate: true,
                items: {
                    select: { itemId: true }
                }
            }
        });

        // Group lead times by itemId
        const requestMap = new Map<string, Array<{ createdAt: Date; receivedDate: Date }>>();
        for (const req of allRequests) {
            for (const reqItem of req.items) {
                if (reqItem.itemId) {
                    const list = requestMap.get(reqItem.itemId) || [];
                    list.push({ createdAt: req.createdAt, receivedDate: req.receivedDate! });
                    requestMap.set(reqItem.itemId, list);
                }
            }
        }

        const results = [];
        const updatePromises = [];

        for (const item of items) {
            // A. Calculate Consumption (Daily Demand)
            const usages = usageMap.get(item.id) || [];

            // Map quantities by day
            const dailyQuantities: Record<string, number> = {};
            usages.forEach(u => {
                const dateKey = u.createdAt.toISOString().slice(0, 10);
                dailyQuantities[dateKey] = (dailyQuantities[dateKey] || 0) + u.quantity;
            });

            const dailyCounts = Object.values(dailyQuantities);
            const totalUsageDays = dailyCounts.length;

            const avgDailyDemand = totalUsageDays > 0 
                ? dailyCounts.reduce((a, b) => a + b, 0) / 90 // Average daily consumption over 90 days
                : 0;

            const maxDailyDemand = totalUsageDays > 0 
                ? Math.max(...dailyCounts) 
                : 0;

            // B. Calculate Lead Time (Procurement Duration)
            const requests = requestMap.get(item.id) || [];

            const leadTimesInDays = requests.map(r => {
                const diffTime = Math.abs(r.receivedDate.getTime() - r.createdAt.getTime());
                return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24))); // minimum of 1 day
            });

            const avgLeadTime = leadTimesInDays.length > 0
                ? leadTimesInDays.reduce((a, b) => a + b, 0) / leadTimesInDays.length
                : 7; // default fallback lead time: 7 days

            const maxLeadTime = leadTimesInDays.length > 0
                ? Math.max(...leadTimesInDays)
                : 14; // default fallback max lead time: 14 days

            // C. ROP and Safety Stock Formulas
            // Safety Stock = (Max Daily Demand * Max Lead Time) - (Avg Daily Demand * Avg Lead Time)
            const safetyStock = (maxDailyDemand * maxLeadTime) - (avgDailyDemand * avgLeadTime);
            const safetyStockFinal = Math.max(0, Math.round(safetyStock * 100) / 100);

            // Reorder Point (ROP) = (Avg Daily Demand * Avg Lead Time) + Safety Stock
            const rop = (avgDailyDemand * avgLeadTime) + safetyStockFinal;
            const ropFinal = Math.max(0, Math.round(rop * 100) / 100);

            // D. Push update promises
            updatePromises.push(
                prisma.inventoryItem.update({
                    where: { id: item.id },
                    data: { minLevel: ropFinal }
                })
            );

            updatePromises.push(
                prisma.inventoryStock.updateMany({
                    where: { itemId: item.id },
                    data: { minLevel: ropFinal }
                })
            );

            results.push({
                itemId: item.id,
                itemCode: item.code,
                itemName: item.name,
                avgDailyDemand: Math.round(avgDailyDemand * 100) / 100,
                maxDailyDemand: Math.round(maxDailyDemand * 100) / 100,
                avgLeadTime: Math.round(avgLeadTime * 10) / 10,
                maxLeadTime,
                safetyStock: safetyStockFinal,
                reorderPoint: ropFinal
            });
        }

        // E. Run update transactions in chunked batches
        const BATCH_SIZE = 50;
        for (let i = 0; i < updatePromises.length; i += BATCH_SIZE) {
            await prisma.$transaction(updatePromises.slice(i, i + BATCH_SIZE));
        }

        return results;
    }
}
