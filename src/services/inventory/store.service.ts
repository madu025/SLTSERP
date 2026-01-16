import { prisma } from '@/lib/prisma';
import { InventoryStore, Prisma } from '@prisma/client';
import { NotificationService } from '../notification.service';
import { StoreWithDetails } from './types';

export class StoreService {
    static async getStores(where: Prisma.InventoryStoreWhereInput = {}): Promise<StoreWithDetails[]> {
        return await prisma.inventoryStore.findMany({
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
        });
    }

    static async createStore(data: {
        name: string;
        type: string;
        location?: string;
        managerId?: string;
        opmcIds?: string[];
    }): Promise<InventoryStore> {
        const { opmcIds, ...storeData } = data;

        const store = await prisma.inventoryStore.create({
            data: {
                name: storeData.name,
                type: storeData.type,
                location: storeData.location,
                managerId: storeData.managerId === 'none' ? null : storeData.managerId
            }
        });

        if (opmcIds && Array.isArray(opmcIds) && opmcIds.length > 0) {
            await prisma.oPMC.updateMany({
                where: { id: { in: opmcIds } },
                data: { storeId: store.id }
            });
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

        const store = await prisma.inventoryStore.update({
            where: { id },
            data: {
                name: storeData.name,
                type: storeData.type,
                location: storeData.location,
                managerId: storeData.managerId === 'none' ? null : storeData.managerId
            }
        });

        // Update OPMC assignments
        if (opmcIds !== undefined) {
            // First, remove all current assignments
            await prisma.oPMC.updateMany({
                where: { storeId: id },
                data: { storeId: null }
            });

            // Then assign new OPMCs
            if (Array.isArray(opmcIds) && opmcIds.length > 0) {
                await prisma.oPMC.updateMany({
                    where: { id: { in: opmcIds } },
                    data: { storeId: id }
                });
            }
        }

        return store;
    }

    static async getStore(id: string): Promise<StoreWithDetails | null> {
        return await prisma.inventoryStore.findUnique({
            where: { id },
            include: {
                opmcs: true,
                manager: true
            }
        });
    }

    static async deleteStore(id: string): Promise<void> {
        if (!id) throw new Error('ID_REQUIRED');

        const hasStock = await prisma.inventoryStock.findFirst({
            where: { storeId: id, quantity: { gt: 0 } }
        });
        if (hasStock) throw new Error('STORE_HAS_STOCK');

        // Remove OPMC assignments first
        await prisma.oPMC.updateMany({
            where: { storeId: id },
            data: { storeId: null }
        });

        await prisma.inventoryStore.delete({ where: { id: id } });
    }

    /**
     * Check if item stock is below minimum level and notify
     */
    static async checkLowStock(storeId: string, itemId: string): Promise<void> {
        try {
            const stock = await prisma.inventoryStock.findUnique({
                where: { storeId_itemId: { storeId, itemId } },
                include: {
                    item: true,
                    store: {
                        include: {
                            manager: { select: { id: true, name: true } }
                        }
                    }
                }
            });

            if (!stock || !stock.item || !stock.store) return;

            if (stock.quantity <= stock.minLevel) {
                // Determine recipients: Store Manager and potentially Area Managers
                const roles = ['STORE_KEEPER', 'OFFICE_ADMIN', 'AREA_MANAGER', 'OSP_MANAGER'];

                await NotificationService.notifyByRole({
                    roles,
                    title: 'Low Stock Alert',
                    message: `Item ${stock.item.code} (${stock.item.name}) is low at ${stock.store.name}. Current: ${stock.quantity}, Min Level: ${stock.minLevel}`,
                    type: 'INVENTORY',
                    priority: 'HIGH',
                    link: '/admin/inventory/stock'
                });
            }
        } catch (error) {
            console.error('Failed to check low stock:', error);
        }
    }
}
