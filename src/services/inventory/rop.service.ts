import { prisma } from '@/lib/prisma';
import { UUID } from '@/types/common';

export class ROPService {
    /**
     * Calculate and update Reorder Points (ROP) and Safety Stocks for all active inventory items.
     * Now powered by DB function fn_update_rop_levels() which runs entirely in PostgreSQL.
     * The DB function uses consumption data (SODMaterialUsage) and procurement lead times
     * (StockRequest) over the past 90 days, computing safety stock and ROP atomically.
     */
    static async updateDynamicSafetyLevels() {
        // Call the DB function that does everything in a single PostgreSQL call:
        // 1. Computes daily demand from SODMaterialUsage (last 90 days)
        // 2. Computes lead times from StockRequest receivedDate - createdAt
        // 3. Calculates safety stock = (maxDaily * maxLT) - (avgDaily * avgLT)
        // 4. Calculates ROP = (avgDaily * avgLT) + safetyStock
        // 5. Updates InventoryItem.minLevel and InventoryStock.minLevel
        const updatedCount = await prisma.$queryRaw<[{ updated: number }]>`
            SELECT fn_update_rop_levels() as updated
        `;

        // Fetch the results for reporting
        const ropData = await prisma.$queryRaw<Array<{
            item_id: UUID;
            item_code: string;
            item_name: string;
            avg_daily_demand: number;
            max_daily_demand: number;
            avg_lead_time: number;
            max_lead_time: number;
            safety_stock: number;
            reorder_point: number;
        }>>`SELECT * FROM fn_calculate_rop_all_items()`;

        return ropData.map(row => ({
            itemId: row.item_id,
            itemCode: row.item_code,
            itemName: row.item_name,
            avgDailyDemand: Number(row.avg_daily_demand),
            maxDailyDemand: Number(row.max_daily_demand),
            avgLeadTime: Number(row.avg_lead_time),
            maxLeadTime: Number(row.max_lead_time),
            safetyStock: Number(row.safety_stock),
            reorderPoint: Number(row.reorder_point)
        }));
    }
}
