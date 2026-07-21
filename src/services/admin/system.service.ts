import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';

export class AdminSystemService {
    /**
     * Clear all ServiceOrder related data in correct order
     */
    static async clearAllServiceOrders() {
        const results = {
            statusHistory: 0,
            materialUsage: 0,
            restoreRequests: 0,
            serviceOrders: 0,
            dashboardStats: 0,
            patStatus: 0,
        };

        console.log('[CLEAR-SOD] Step 1: Clearing ServiceOrderStatusHistory...');
        const historyResult = await prisma.serviceOrderStatusHistory.deleteMany();
        results.statusHistory = historyResult.count;

        console.log('[CLEAR-SOD] Step 2: Clearing SODMaterialUsage...');
        const materialResult = await prisma.sODMaterialUsage.deleteMany();
        results.materialUsage = materialResult.count;

        console.log('[CLEAR-SOD] Step 3: Clearing RestoreRequests...');
        const restoreResult = await prisma.restoreRequest.deleteMany();
        results.restoreRequests = restoreResult.count;

        console.log('[CLEAR-SOD] Step 4: Clearing ServiceOrders...');
        const serviceOrderResult = await prisma.serviceOrder.deleteMany();
        results.serviceOrders = serviceOrderResult.count;

        console.log('[CLEAR-SOD] Step 5: Clearing DashboardStats...');
        const statsResult = await prisma.dashboardStat.deleteMany();
        results.dashboardStats = statsResult.count;

        console.log('[CLEAR-SOD] Step 6: Clearing SLTPATStatus...');
        const patResult = await prisma.sLTPATStatus.deleteMany();
        results.patStatus = patResult.count;

        console.log('[CLEAR-SOD] ✅ All data cleared successfully:', results);
        return results;
    }

    /**
     * Hard reset all SODs and Invoices
     */
    static async resetSystemData() {
        await prisma.$transaction(async (tx) => {
            // Delete child records first
            await tx.serviceOrderStatusHistory.deleteMany({});
            await tx.sODMaterialUsage.deleteMany({});
            await tx.restoreRequest.deleteMany({});

            // Disconnect or delete Invoices if any
            await tx.serviceOrder.updateMany({
                data: { invoiceId: null }
            });
            await tx.invoice.deleteMany({});

            // Now delete main Service Orders
            await tx.serviceOrder.deleteMany({});

            // Clear SLT API Caches
            await tx.sLTPATStatus.deleteMany({});

            // Reset Dashboard Stats to 0
            await tx.dashboardStat.updateMany({
                data: {
                    pending: 0,
                    completed: 0,
                    returned: 0,
                    patPassed: 0,
                    patRejected: 0,
                    sltsPatRejected: 0
                }
            });

            console.log('[SYSTEM-RESET] Data cleared successfully.');
        });
    }

    /**
     * Get basic system stats (counts)
     */
    static async getSystemStats() {
        const [users, staff, opmcs, contractors] = await Promise.all([
            prisma.user.count(),
            prisma.staff.count(),
            prisma.oPMC.count(),
            prisma.contractor.count()
        ]);

        return {
            users,
            staff,
            opmcs,
            contractors
        };
    }

    /**
     * Get system sync stats
     */
    static async getSyncStats() {
        const syncStats = await (prisma as any).systemSetting.findUnique({
            where: { key: 'LAST_SYNC_STATS' }
        });

        if (!syncStats) {
            return {
                lastSync: null,
                nextSync: null,
                stats: null,
                isStale: true
            };
        }

        const stats = syncStats.value as any;
        const lastSync = stats.lastSyncTriggered || stats.lastSync || new Date().toISOString();
        const lastSyncDate = new Date(lastSync);
        const nextSyncDate = new Date(lastSyncDate.getTime() + 30 * 60 * 1000); // 30 minutes later

        // Stale if last sync was more than 45 minutes ago
        const isStale = (Date.now() - lastSyncDate.getTime()) > (45 * 60 * 1000);

        return {
            lastSync: lastSync,
            nextSync: nextSyncDate.toISOString(),
            stats: {
                created: stats.created || 0,
                updated: stats.updated || 0,
                failed: stats.failed || 0,
                patUpdated: stats.patUpdated || 0,
                queuedCount: stats.queuedCount || 0
            },
            isStale
        };
    }

    /**
     * Get table column settings
     */
    static async getTableSettings(tableName?: string | null, tableColumnsDef: Record<string, any[]> = {}) {
        if (tableName) {
            const settings = await (prisma as any).tableColumnSettings.findUnique({
                where: { tableName }
            });

            const availableColumns = tableColumnsDef[tableName] || [];
            const visibleColumns = settings ? JSON.parse(settings.columns) : availableColumns.map(c => c.key);

            return {
                tableName,
                availableColumns,
                visibleColumns
            };
        }

        const allSettings = await (prisma as any).tableColumnSettings.findMany();
        const result: Record<string, any> = {};

        for (const tableKey of Object.keys(tableColumnsDef)) {
            const setting = allSettings.find((s: any) => s.tableName === tableKey);
            const availableColumns = tableColumnsDef[tableKey];
            result[tableKey] = {
                tableName: tableKey,
                availableColumns,
                visibleColumns: setting ? JSON.parse(setting.columns) : availableColumns.map(c => c.key)
            };
        }

        return result;
    }

    /**
     * Update table column settings
     */
    static async updateTableSettings(tableName: string, visibleColumns: string[], tableColumnsDef: Record<string, any[]>) {
        const tableColumns = tableColumnsDef[tableName];
        if (!tableColumns) {
            throw AppError.badRequest('Invalid table name');
        }

        const requiredColumns = tableColumns.filter(c => c.required).map(c => c.key);
        const finalColumns = [...new Set([...requiredColumns, ...visibleColumns])];

        const settings = await (prisma as any).tableColumnSettings.upsert({
            where: { tableName },
            update: { columns: JSON.stringify(finalColumns) },
            create: { tableName, columns: JSON.stringify(finalColumns) }
        });

        return {
            tableName,
            visibleColumns: JSON.parse(settings.columns)
        };
    }
}
