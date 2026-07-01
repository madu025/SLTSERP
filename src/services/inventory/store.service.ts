import { InventoryRepository } from '@/repositories/inventory.repository';
import { InventoryStore, Prisma } from '@prisma/client';
import { eventBus } from '@/lib/events/event-bus';
import { prisma } from '@/lib/prisma';
import { StoreWithDetails } from './types';

export class StoreService {
    static async getAccessibleStores(userId: string, userRole: string): Promise<StoreWithDetails[]> {
        const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
        let whereClause: Prisma.InventoryStoreWhereInput = {};

        if (!isAdmin) {
            const dbUser = await prisma.user.findUnique({
                where: { id: userId },
                include: { accessibleOpmcs: true }
            });

            if (!dbUser) {
                throw new Error('USER_NOT_FOUND');
            }

            const accessibleOpmcIds = dbUser.accessibleOpmcs.map(o => o.id);

            const baseWhere: Prisma.InventoryStoreWhereInput = {
                OR: [
                    { managerId: userId },
                    { opmcs: { some: { id: { in: accessibleOpmcIds } } } }
                ]
            };

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

        const store = await InventoryRepository.createStore({
            name: storeData.name,
            type: storeData.type,
            location: storeData.location,
            managerId: storeData.managerId === 'none' ? null : storeData.managerId
        });

        if (opmcIds && Array.isArray(opmcIds) && opmcIds.length > 0) {
            await InventoryRepository.updateManyOpmcs(
                { id: { in: opmcIds } },
                { storeId: store.id }
            );
        }

        return store;
    }

    static async updateStore(id: string, data: {
        name?: string;
        type?: string;
        location?: string;
        managerId?: string;
        opmcIds?: string[];
    }): Promise<InventoryStore> {
        if (!id) throw new Error('ID_REQUIRED');

        const { opmcIds, ...storeData } = data;

        const store = await InventoryRepository.updateStore(id, {
            name: storeData.name,
            type: storeData.type,
            location: storeData.location,
            managerId: storeData.managerId === 'none' ? null : storeData.managerId
        });

        // Update OPMC assignments
        if (opmcIds !== undefined) {
            // First, remove all current assignments
            await InventoryRepository.updateManyOpmcs(
                { storeId: id },
                { storeId: null }
            );

            // Then assign new OPMCs
            if (Array.isArray(opmcIds) && opmcIds.length > 0) {
                await InventoryRepository.updateManyOpmcs(
                    { id: { in: opmcIds } },
                    { storeId: id }
                );
            }
        }

        return store;
    }

    static async getStore(id: string): Promise<StoreWithDetails | null> {
        return await InventoryRepository.findStoreWithDetails(id, {
            opmcs: true,
            manager: true
        }) as StoreWithDetails | null;
    }

    static async deleteStore(id: string): Promise<void> {
        if (!id) throw new Error('ID_REQUIRED');

        const hasStock = await InventoryRepository.findFirstStock({
            storeId: id,
            quantity: { gt: 0 }
        });
        if (hasStock) throw new Error('STORE_HAS_STOCK');

        // Remove OPMC assignments first
        await InventoryRepository.updateManyOpmcs(
            { storeId: id },
            { storeId: null }
        );

        await InventoryRepository.deleteStore(id);
    }

    /**
     * Check if item stock is below minimum level and notify
     */
    static async checkLowStock(storeId: string, itemId: string): Promise<void> {
        try {
            const stocks = await InventoryRepository.findManyStocks(
                { storeId, itemId },
                {
                    item: true,
                    store: {
                        include: {
                            manager: { select: { id: true, name: true } }
                        }
                    }
                }
            );
            const stock = stocks[0];
            if (!stock || !stock.item || !stock.store) return;

            if (stock.quantity <= stock.minLevel) {
                await eventBus.publish('inventory.low_stock_detected', {
                    store: stock.store.name,
                    item: stock.item.name || stock.item.code,
                    currentStock: stock.quantity,
                    minStock: stock.minLevel
                });
            }
        } catch (error) {
            console.error('Failed to check low stock:', error);
        }
    }
}
