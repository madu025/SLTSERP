import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { SystemService } from '@/services/core/system.service';

export interface TableColumnDef {
    key: string;
    label: string;
    required?: boolean;
}

function parseStoredColumns(raw: string): string[] | null {
    try {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.every((c) => typeof c === 'string')) {
            return parsed;
        }
        return null;
    } catch {
        return null;
    }
}

export class AdminSystemService {
    /**
     * Clear all ServiceOrder related data in correct order (atomic)
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

        await prisma.$transaction(async (tx) => {
            console.log('[CLEAR-SOD] Step 1: Clearing ServiceOrderStatusHistory...');
            results.statusHistory = (await tx.serviceOrderStatusHistory.deleteMany()).count;

            console.log('[CLEAR-SOD] Step 2: Clearing SODMaterialUsage...');
            results.materialUsage = (await tx.sODMaterialUsage.deleteMany()).count;

            console.log('[CLEAR-SOD] Step 3: Clearing RestoreRequests...');
            results.restoreRequests = (await tx.restoreRequest.deleteMany()).count;

            console.log('[CLEAR-SOD] Step 4: Clearing ServiceOrders...');
            results.serviceOrders = (await tx.serviceOrder.deleteMany()).count;

            console.log('[CLEAR-SOD] Step 5: Clearing DashboardStats...');
            results.dashboardStats = (await tx.dashboardStat.deleteMany()).count;

            console.log('[CLEAR-SOD] Step 6: Clearing SLTPATStatus...');
            results.patStatus = (await tx.sLTPATStatus.deleteMany()).count;
        });

        console.log('[CLEAR-SOD] All data cleared successfully:', results);
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
        const syncStats = await prisma.systemSetting.findUnique({
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

        const stats = (syncStats.value ?? {}) as Record<string, string | number>;
        const lastSync = String(stats.lastSyncTriggered || stats.lastSync || new Date().toISOString());
        const lastSyncDate = new Date(lastSync);

        // Sync cadence is configurable via SystemConfig (admin UI), fallback 30 minutes
        const intervalMinutes = Number(await SystemService.getConfig('SYNC_INTERVAL_MINUTES', '30')) || 30;
        const intervalMs = intervalMinutes * 60 * 1000;
        const nextSyncDate = new Date(lastSyncDate.getTime() + intervalMs);

        // Stale if last sync was older than 1.5 intervals
        const isStale = (Date.now() - lastSyncDate.getTime()) > intervalMs * 1.5;

        return {
            lastSync: lastSync,
            nextSync: nextSyncDate.toISOString(),
            stats: {
                created: Number(stats.created) || 0,
                updated: Number(stats.updated) || 0,
                failed: Number(stats.failed) || 0,
                patUpdated: Number(stats.patUpdated) || 0,
                queuedCount: Number(stats.queuedCount) || 0
            },
            isStale
        };
    }

    /**
     * Get table column settings
     */
    static async getTableSettings(tableName?: string | null, tableColumnsDef: Record<string, TableColumnDef[]> = {}) {
        if (tableName) {
            const settings = await prisma.tableColumnSettings.findUnique({
                where: { tableName }
            });

            const availableColumns = tableColumnsDef[tableName] || [];
            const visibleColumns = settings
                ? (parseStoredColumns(settings.columns) ?? availableColumns.map(c => c.key))
                : availableColumns.map(c => c.key);

            return {
                tableName,
                availableColumns,
                visibleColumns
            };
        }

        const allSettings = await prisma.tableColumnSettings.findMany();
        const result: Record<string, {
            tableName: string;
            availableColumns: TableColumnDef[];
            visibleColumns: string[];
        }> = {};

        for (const tableKey of Object.keys(tableColumnsDef)) {
            const setting = allSettings.find((s) => s.tableName === tableKey);
            const availableColumns = tableColumnsDef[tableKey];
            result[tableKey] = {
                tableName: tableKey,
                availableColumns,
                visibleColumns: setting
                    ? (parseStoredColumns(setting.columns) ?? availableColumns.map(c => c.key))
                    : availableColumns.map(c => c.key)
            };
        }

        return result;
    }

    /**
     * Update table column settings
     */
    static async updateTableSettings(tableName: string, visibleColumns: string[], tableColumnsDef: Record<string, TableColumnDef[]>) {
        const tableColumns = tableColumnsDef[tableName];
        if (!tableColumns) {
            throw AppError.badRequest('Invalid table name');
        }

        const requiredColumns = tableColumns.filter(c => c.required).map(c => c.key);
        const finalColumns = [...new Set([...requiredColumns, ...visibleColumns])];

        const settings = await prisma.tableColumnSettings.upsert({
            where: { tableName },
            update: { columns: JSON.stringify(finalColumns) },
            create: { tableName, columns: JSON.stringify(finalColumns) }
        });

        return {
            tableName,
            visibleColumns: parseStoredColumns(settings.columns) ?? finalColumns
        };
    }
}
