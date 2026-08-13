import { ROLE_GROUPS } from '@/config/roles';
import { AppError } from '@/lib/error';
import { InventoryRepository } from '@/repositories/inventory.repository';
import { InventoryStore, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { safe } from '@/utils/safe-await.util';
import { StoreWithDetails, TransactionClient, UUID } from '@/types/inventory/inventory-service.types';

export class StoreService {
    /** Low stock alerts are now handled by DB trigger trg_low_stock_auto_alert with InventoryAlertCooldown table */
    /** Only real user UUIDs may perform store-scoped writes; 'SYSTEM' actors are rejected */
    private static readonly UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    /**
     * Store-Scope Enforcement (write paths).
     *
     * Resolves the caller's permitted stores from User.assignedStoreId,
     * Store.managerId and OPMC-linked stores (mirrors getAccessibleStores)
     * and throws a 403 STORE_SCOPE_VIOLATION when the target store is out
     * of scope. ADMINS (SUPER_ADMIN/ADMIN/CEO/HEAD_OF_OSP) bypass; stores
     * staff holding MAIN-store access inherit all-store access exactly like
     * the read path does.
     */
    static async assertStoreWriteAccess(userId: string | null | undefined, storeId: UUID, tx?: TransactionClient): Promise<void> {
        // Share the caller's transaction snapshot when a tx client is provided
        // so the permission read is consistent with the surrounding write.
        const db = (tx ?? prisma) as unknown as typeof prisma;
        if (!userId || !StoreService.UUID_RE.test(userId)) {
            throw AppError.forbidden('STORE_SCOPE_VIOLATION: An authenticated user identity is required for store write operations.');
        }

        const dbUser = await db.user.findUnique({
            where: { id: userId },
            select: {
                role: true,
                assignedStoreId: true,
                accessibleOpmcs: { select: { id: true } }
            }
        });

        if (!dbUser) {
            throw AppError.forbidden('STORE_SCOPE_VIOLATION: USER_NOT_FOUND');
        }

        // Admin-tier bypass (mirrors getAccessibleStores isAdmin)
        if ((ROLE_GROUPS.ADMINS as readonly string[]).includes(dbUser.role)) {
            return;
        }

        if (dbUser.assignedStoreId === storeId) {
            return;
        }

        const store = await db.inventoryStore.findUnique({
            where: { id: storeId },
            select: { id: true, type: true, managerId: true, opmcs: { select: { id: true } } }
        });

        if (!store) {
            throw AppError.notFound('STORE_NOT_FOUND');
        }

        const accessibleOpmcIds = dbUser.accessibleOpmcs.map(o => o.id);
        const accessibleOpmcSet = new Set(accessibleOpmcIds);

        // Direct grants: store manager or OPMC-linked store
        if (store.managerId === userId || store.opmcs.some(o => accessibleOpmcSet.has(o.id))) {
            return;
        }

        // Stores staff with MAIN-store access inherit all-store access
        // (mirrors the isStoreStaff escalation in getAccessibleStores)
        const isStoreStaff = dbUser.role === 'STORES_MANAGER' || dbUser.role === 'STORES_ASSISTANT';
        if (isStoreStaff) {
            const mainStoreWhere: Prisma.InventoryStoreWhereInput = {
                type: 'MAIN',
                OR: [
                    { managerId: userId },
                    { opmcs: { some: { id: { in: accessibleOpmcIds } } } },
                    ...(dbUser.assignedStoreId ? [{ id: dbUser.assignedStoreId }] : [])
                ]
            };
            const hasMainAccess = await db.inventoryStore.findFirst({
                where: mainStoreWhere,
                select: { id: true }
            });
            if (hasMainAccess) {
                return;
            }
        }

        throw AppError.forbidden(`STORE_SCOPE_VIOLATION: User does not have write access to store ${storeId}.`);
    }

    static async getAccessibleStores(userId: string, userRole: string): Promise<StoreWithDetails[]> {
        const isAdmin = (ROLE_GROUPS.ADMINS as readonly string[]).includes(userRole);
        let whereClause: Prisma.InventoryStoreWhereInput = {};

        if (!isAdmin) {
            const dbUser = await prisma.user.findUnique({
                where: { id: userId },
                include: { accessibleOpmcs: true }
            });

            if (!dbUser) {
                throw AppError.badRequest('USER_NOT_FOUND');
            }

            const accessibleOpmcIds = dbUser.accessibleOpmcs.map(o => o.id);

            const baseWhere: Prisma.InventoryStoreWhereInput = {
                OR: [
                    { managerId: userId },
                    { opmcs: { some: { id: { in: accessibleOpmcIds } } } }
                ]
            };

            if (dbUser.assignedStoreId) {
                baseWhere.OR?.push({ id: dbUser.assignedStoreId });
            }

            const isStoreStaff = userRole === 'STORES_MANAGER' || userRole === 'STORES_ASSISTANT';

            if (isStoreStaff) {
                const hasMainAccess = await InventoryRepository.findFirstStore({
                    where: {
                        ...baseWhere,
                        type: 'MAIN'
                    }
                });

                if (hasMainAccess) {
                    whereClause = {};
                } else {
                    whereClause = baseWhere;
                }
            } else {
                whereClause = baseWhere;
            }
        }

        return this.getStores(whereClause);
    }

    static async getStores(where: Prisma.InventoryStoreWhereInput = {}): Promise<StoreWithDetails[]> {
        return await InventoryRepository.findStores({
            where,
            include: {
                manager: {
                    select: { id: true, name: true, email: true }
                },
                opmcs: {
                    select: { id: true, name: true, rtom: true }
                }
            },
            orderBy: { name: 'asc' }
        }) as StoreWithDetails[];
    }

    static async createStore(data: {
        name: string;
        type: string;
        location?: string;
        managerId?: string;
        opmcIds?: string[];
    }): Promise<InventoryStore> {
        const { opmcIds, ...storeData } = data;

        return await prisma.$transaction(async (tx) => {
            const store = await InventoryRepository.createStore({
                name: storeData.name,
                type: storeData.type,
                location: storeData.location,
                managerId: storeData.managerId === 'none' ? null : storeData.managerId
            }, tx);

            if (opmcIds && Array.isArray(opmcIds) && opmcIds.length > 0) {
                await InventoryRepository.updateManyOpmcs(
                    { id: { in: opmcIds } },
                    { storeId: store.id },
                    tx
                );
            }

            return store;
        });
    }

    static async updateStore(id: string, data: {
        name?: string;
        type?: string;
        location?: string;
        managerId?: string;
        opmcIds?: string[];
    }): Promise<InventoryStore> {
        if (!id) throw AppError.badRequest('ID_REQUIRED');

        const { opmcIds, ...storeData } = data;

        return await prisma.$transaction(async (tx) => {
            const store = await InventoryRepository.updateStore(id, {
                name: storeData.name,
                type: storeData.type,
                location: storeData.location,
                managerId: storeData.managerId === 'none' ? null : storeData.managerId
            }, tx);

            // Update OPMC assignments
            if (opmcIds !== undefined) {
                // First, remove all current assignments
                await InventoryRepository.updateManyOpmcs(
                    { storeId: id },
                    { storeId: null },
                    tx
                );

                // Then assign new OPMCs
                if (Array.isArray(opmcIds) && opmcIds.length > 0) {
                    await InventoryRepository.updateManyOpmcs(
                        { id: { in: opmcIds } },
                        { storeId: id },
                        tx
                    );
                }
            }

            return store;
        });
    }

    static async getStore(id: string): Promise<StoreWithDetails | null> {
        return await InventoryRepository.findStoreWithDetails(id, {
            opmcs: true,
            manager: true
        }) as StoreWithDetails | null;
    }

    static async deleteStore(id: string): Promise<void> {
        if (!id) throw AppError.badRequest('ID_REQUIRED');

        const hasStock = await InventoryRepository.findFirstStock({
            storeId: id,
            quantity: { gt: 0 }
        });
        if (hasStock) throw AppError.badRequest('STORE_HAS_STOCK');

        // Remove OPMC assignments first
        await InventoryRepository.updateManyOpmcs(
            { storeId: id },
            { storeId: null }
        );

        await InventoryRepository.deleteStore(id);
    }

    /**
     * Check if item stock is below minimum level.
     * Notifications are now handled automatically by DB trigger trg_low_stock_auto_alert.
     * This method now only returns the current low-stock status for API/query purposes.
     */
    static async checkLowStock(storeId: UUID, itemId: UUID): Promise<void> {
        // DB trigger trg_low_stock_auto_alert fires automatically on InventoryStock UPDATE
        // when quantity drops to/below minLevel. No JS-side check needed.
        // This method is kept as a no-op for backward compatibility with the API route.
    }

    /**
     * Get store material balance with reorder alerts using DB function fn_store_material_balance().
     * Runs entirely in PostgreSQL - no data egress for computation.
     */
    static async getMaterialBalance(storeId: UUID, category?: string | null) {
        const result = await prisma.$queryRaw<Array<{
            item_id: UUID;
            item_code: string;
            item_name: string;
            current_stock: number;
            allocated_stock: number;
            available_stock: number;
            min_level: number;
            reorder_needed: boolean;
            total_value: number;
        }>>`
            SELECT * FROM fn_store_material_balance(
                ${storeId}::uuid,
                ${category || null}::text
            )
        `;
        return result;
    }

    /**
     * Get low stock alerts using DB function fn_low_stock_alerts().
     * Returns items below minimum stock level with deficit calculation.
     * Runs entirely in PostgreSQL - no data egress.
     */
    static async getLowStockAlerts(storeId: UUID) {
        const result = await prisma.$queryRaw<Array<{
            item_id: UUID;
            item_code: string;
            item_name: string;
            current_stock: number;
            min_level: number;
            deficit: number;
        }>>`
            SELECT * FROM fn_low_stock_alerts(${storeId}::uuid)
        `;
        return result;
    }

    /**
     * Get inventory value summary by category using DB function fn_store_inventory_value().
     * Runs entirely in PostgreSQL - no data egress.
     */
    static async getInventoryValue(storeId: UUID) {
        const result = await prisma.$queryRaw<Array<{
            category: string;
            item_count: number;
            total_quantity: number;
            total_value: number;
        }>>`
            SELECT * FROM fn_store_inventory_value(${storeId}::uuid)
        `;
        return result;
    }

    /**
     * Get expiring batches using DB function fn_expiring_batches().
     * Returns batches expiring within the specified number of days.
     * Runs entirely in PostgreSQL - no data egress.
     */
    static async getExpiringBatches(storeId: UUID, daysAhead: number = 30) {
        const result = await prisma.$queryRaw<Array<{
            batch_id: UUID;
            batch_number: string;
            item_code: string;
            item_name: string;
            quantity: number;
            expiry_date: Date;
            days_until_expiry: number;
        }>>`
            SELECT * FROM fn_expiring_batches(
                ${storeId}::uuid,
                ${daysAhead}::int
            )
        `;
        return result;
    }

    /**
     * Get material balance across multiple stores in a single DB call.
     * Eliminates N+1 query pattern from per-store fn_store_material_balance calls.
     */
    static async getMultiStoreMaterialBalance(storeIds: UUID[], category?: string | null) {
        const result = await prisma.$queryRaw<Array<{
            store_id: UUID;
            store_name: string;
            item_id: UUID;
            item_code: string;
            item_name: string;
            current_stock: number;
            allocated_stock: number;
            available_stock: number;
            min_level: number;
            reorder_needed: boolean;
            total_value: number;
        }>>`
            SELECT * FROM fn_multi_store_material_balance(
                ${storeIds}::uuid[],
                ${category || null}::text
            )
        `;
        return result;
    }

    /**
     * Get expiring batches across multiple stores in a single DB call.
     * Eliminates N+1 query pattern from per-store fn_expiring_batches calls.
     */
    static async getMultiStoreExpiringBatches(storeIds: UUID[], daysAhead: number = 30) {
        const result = await prisma.$queryRaw<Array<{
            store_id: UUID;
            store_name: string;
            batch_id: UUID;
            batch_number: string;
            item_code: string;
            item_name: string;
            quantity: number;
            expiry_date: Date;
            days_until_expiry: number;
        }>>`
            SELECT * FROM fn_multi_store_expiring_batches(
                ${storeIds}::uuid[],
                ${daysAhead}::int
            )
        `;
        return result;
    }

    /**
     * Get all dashboard KPI metrics in a single DB call.
     * Returns 7 metric rows: total_unique_items, total_quantity, total_value,
     * low_stock_count, pending_dispatch_count, pending_grn_count, pending_mrn_count.
     * Replaces 7 separate Prisma queries.
     */
    static async getDashboardSummary(storeId: UUID) {
        const result = await prisma.$queryRaw<Array<{
            metric_name: string;
            metric_value: number;
        }>>`
            SELECT * FROM fn_store_dashboard_summary(${storeId}::uuid)
        `;
        return result;
    }

    /**
     * Get stock movement report (stock card) with in/out quantities and running balance.
     * Runs entirely in PostgreSQL with window function for running balance.
     */
    static async getStockMovementReport(storeId: UUID, fromDate?: Date | null, toDate?: Date | null) {
        const result = await prisma.$queryRaw<Array<{
            transaction_date: Date;
            transaction_type: string;
            transaction_id: UUID;
            item_id: UUID;
            item_code: string;
            item_name: string;
            quantity_in: number;
            quantity_out: number;
            running_balance: number;
        }>>`
            SELECT * FROM fn_stock_movement_report(
                ${storeId}::uuid,
                ${fromDate || null}::date,
                ${toDate || null}::date
            )
        `;
        return result;
    }

    /**
     * Get basic list of public site offices (stores) for dropdowns
     */
    static async getPublicSiteOffices() {
        return InventoryRepository.findStores({
            select: {
                id: true,
                name: true
            },
            orderBy: {
                name: 'asc'
            }
        });
    }
}
