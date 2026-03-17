/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export type TransactionClient = Prisma.TransactionClient;

export class InventoryRepository {
    /**
     * Get all items with optional filters
     */
    static async findManyItems(where: Prisma.InventoryItemWhereInput = {}, tx?: any) {
        const client = tx || prisma;
        return (client as any).inventoryItem.findMany({ where, orderBy: { name: 'asc' } });
    }

    /**
     * Get basic Item details
     */
    static async findItemById(id: string, tx?: any) {
        const client = tx || prisma;
        return (client as any).inventoryItem.findUnique({
            where: { id }
        });
    }

    /**
     * Find store by ID
     */
    static async findStoreById(id: string, tx?: any) {
        const client = tx || prisma;
        return (client as any).inventoryStore.findUnique({
            where: { id }
        });
    }

    /**
     * Get current global stock for an item in a store
     */
    static async findStock(storeId: string, itemId: string, tx?: any) {
        const client = tx || prisma;
        return (client as any).inventoryStock.findUnique({
            where: { storeId_itemId: { storeId, itemId } }
        });
    }

    /**
     * Upsert global stock
     */
    static async upsertStock(storeId: string, itemId: string, quantity: number, tx: any) {
        return (tx as any).inventoryStock.upsert({
            where: { storeId_itemId: { storeId, itemId } },
            create: { storeId, itemId, quantity },
            update: { quantity: { increment: quantity } }
        });
    }

    /**
     * Find available batches for an item (FIFO order)
     */
    static async findAvailableBatches(storeId: string, itemId: string, tx: any) {
        // Lock rows for update to prevent concurrent picking
        await (tx as any).$executeRaw`SELECT id FROM "InventoryBatchStock" WHERE "storeId" = ${storeId} AND "itemId" = ${itemId} AND "quantity" > 0 FOR UPDATE`;
        
        return (tx as any).inventoryBatchStock.findMany({
            where: { storeId, itemId, quantity: { gt: 0 } },
            include: { batch: true },
            orderBy: { batch: { createdAt: 'asc' } }
        });
    }

    /**
     * Update batch quantity
     */
    static async updateBatchStock(storeId: string, batchId: string, quantity: number, tx: any) {
        return (tx as any).inventoryBatchStock.update({
            where: { storeId_batchId: { storeId, batchId } },
            data: { quantity: { increment: quantity } }
        });
    }

    /**
     * Record a transaction
     */
    static async createTransaction(data: Prisma.InventoryTransactionUncheckedCreateInput, tx: any) {
        return (tx as any).inventoryTransaction.create({
            data
        });
    }
}
