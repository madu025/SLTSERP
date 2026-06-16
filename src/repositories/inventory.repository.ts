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
            where: { id },
            include: { opmcs: { select: { id: true } } }
        });
    }

    /**
     * Find the main central store
     */
    static async findMainStore(tx?: any) {
        const client = tx || prisma;
        return (client as any).inventoryStore.findFirst({
            where: { type: 'MAIN' }
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
     * Get current global stocks for a store
     */
    static async findManyStocks(where: Prisma.InventoryStockWhereInput, include?: any, tx?: any) {
        const client = tx || prisma;
        return (client as any).inventoryStock.findMany({ where, include, orderBy: { item: { code: 'asc' } } });
    }

    /**
     * Record a transaction
     */
    static async createTransaction(data: Prisma.InventoryTransactionUncheckedCreateInput, tx: any) {
        return (tx as any).inventoryTransaction.create({
            data
        });
    }

    /**
     * Get batches for a store or item
     */
    static async getStoreBatches(where: Prisma.InventoryBatchStockWhereInput, include?: any, tx?: any) {
        const client = tx || prisma;
        return (client as any).inventoryBatchStock.findMany({ where, include, orderBy: { batch: { createdAt: 'desc' } } });
    }

    /**
     * Get batches for a contractor
     */
    static async getContractorBatches(where: Prisma.ContractorBatchStockWhereInput, include?: any, tx?: any) {
        const client = tx || prisma;
        return (client as any).contractorBatchStock.findMany({ where, include, orderBy: { batch: { createdAt: 'desc' } } });
    }

    /**
     * Create a new batch
     */
    static async createBatch(data: Prisma.InventoryBatchUncheckedCreateInput, tx?: any) {
        const client = tx || prisma;
        return (client as any).inventoryBatch.create({ data });
    }

    /**
     * Create batch stock record
     */
    static async createBatchStock(data: Prisma.InventoryBatchStockUncheckedCreateInput, tx?: any) {
        const client = tx || prisma;
        return (client as any).inventoryBatchStock.create({ data });
    }

    /**
     * Create stock issue record
     */
    static async createStockIssue(data: Prisma.StockIssueUncheckedCreateInput, tx?: any) {
        const client = tx || prisma;
        return (client as any).stockIssue.create({ data, include: { items: true } });
    }

    /**
     * Find many stock issues
     */
    static async findManyStockIssues(args: Prisma.StockIssueFindManyArgs, tx?: any) {
        const client = tx || prisma;
        return (client as any).stockIssue.findMany(args);
    }

    /**
     * Update global stock (direct)
     */
    static async updateStock(storeId: string, itemId: string, data: Prisma.InventoryStockUpdateInput, tx?: any) {
        const client = tx || prisma;
        return (client as any).inventoryStock.update({
            where: { storeId_itemId: { storeId, itemId } },
            data
        });
    }

    /**
     * Create transaction item
     */
    static async createTransactionItem(data: Prisma.InventoryTransactionItemUncheckedCreateInput, tx?: any) {
        const client = tx || prisma;
        return (client as any).inventoryTransactionItem.create({ data });
    }

    /**
     * Item Management
     */
    static async findItemsRaw() {
        return prisma.$queryRaw`SELECT * FROM "InventoryItem" ORDER BY "code" ASC` as Promise<any[]>;
    }

    static async findSystemConfig(key: string) {
        const configs: any[] = await prisma.$queryRaw`SELECT value FROM "SystemConfig" WHERE key = ${key} LIMIT 1`;
        return configs[0];
    }

    static async createItem(data: Prisma.InventoryItemCreateInput, tx?: any) {
        const client = tx || prisma;
        return (client as any).inventoryItem.create({ data });
    }

    static async updateItem(id: string, data: Prisma.InventoryItemUpdateInput, tx?: any) {
        const client = tx || prisma;
        return (client as any).inventoryItem.update({ where: { id }, data });
    }

    static async updateManyItems(where: Prisma.InventoryItemWhereInput, data: Prisma.InventoryItemUpdateManyMutationInput, tx?: any) {
        const client = tx || prisma;
        return (client as any).inventoryItem.updateMany({ where, data });
    }

    static async deleteItem(id: string, tx?: any) {
        const client = tx || prisma;
        return (client as any).inventoryItem.delete({ where: { id } });
    }

    static async findItemByCode(code: string, tx?: any) {
        const client = tx || prisma;
        return (client as any).inventoryItem.findUnique({ where: { code } });
    }

    /**
     * Store Management
     */
    static async findStores(args: Prisma.InventoryStoreFindManyArgs, tx?: any) {
        const client = tx || prisma;
        return (client as any).inventoryStore.findMany(args);
    }

    static async findStoreWithDetails(id: string, include?: any, tx?: any) {
        const client = tx || prisma;
        return (client as any).inventoryStore.findUnique({ where: { id }, include });
    }

    static async createStore(data: Prisma.InventoryStoreUncheckedCreateInput, tx?: any) {
        const client = tx || prisma;
        return (client as any).inventoryStore.create({ data });
    }

    static async updateStore(id: string, data: Prisma.InventoryStoreUncheckedUpdateInput, tx?: any) {
        const client = tx || prisma;
        return (client as any).inventoryStore.update({ where: { id }, data });
    }

    static async deleteStore(id: string, tx?: any) {
        const client = tx || prisma;
        return (client as any).inventoryStore.delete({ where: { id } });
    }

    /**
     * OPMC Management (related to stores)
     */
    static async updateManyOpmcs(where: Prisma.OPMCWhereInput, data: Prisma.OPMCUncheckedUpdateManyInput, tx?: any) {
        const client = tx || prisma;
        return (client as any).oPMC.updateMany({ where, data });
    }

    static async findFirstStock(where: Prisma.InventoryStockWhereInput, tx?: any) {
        const client = tx || prisma;
        return (client as any).inventoryStock.findFirst({ where });
    }

    /**
     * GRN Management
     */
    static async findGRNs(args: Prisma.GRNFindManyArgs, tx?: any) {
        const client = tx || prisma;
        return (client as any).gRN.findMany(args);
    }

    static async createGRN(data: Prisma.GRNUncheckedCreateInput, tx?: any) {
        const client = tx || prisma;
        return (client as any).gRN.create({ data, include: { items: true } });
    }

    static async updateGRNItem(id: string, data: Prisma.GRNItemUncheckedUpdateInput, tx?: any) {
        const client = tx || prisma;
        return (client as any).gRNItem.update({ where: { id }, data });
    }
}
