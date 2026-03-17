import { prisma } from '@/lib/prisma';
import { Prisma, StockRequest } from '@prisma/client';

/**
 * StockRequestRepository
 * ----------------------
 * Handles database interactions for StockRequests and their items.
 */
export class StockRequestRepository {
    static async findById(id: string, include?: Prisma.StockRequestInclude, tx?: any) {
        const db = tx || prisma;
        return db.stockRequest.findUnique({
            where: { id },
            include
        });
    }

    static async findMany(args: Prisma.StockRequestFindManyArgs, tx?: any) {
        const db = tx || prisma;
        return db.stockRequest.findMany(args);
    }

    static async create(data: Prisma.StockRequestUncheckedCreateInput, tx?: any): Promise<StockRequest> {
        const db = tx || prisma;
        return db.stockRequest.create({ data });
    }

    static async update(id: string, data: Prisma.StockRequestUncheckedUpdateInput, tx?: any) {
        const db = tx || prisma;
        return db.stockRequest.update({
            where: { id },
            data
        });
    }

    static async updateItem(id: string, data: Prisma.StockRequestItemUncheckedUpdateInput, tx?: any) {
        const db = tx || prisma;
        return db.stockRequestItem.update({
            where: { id },
            data
        });
    }

    static async findItem(id: string, tx?: any) {
        const db = tx || prisma;
        return db.stockRequestItem.findUnique({
            where: { id }
        });
    }

    static async findTransactionItems(referenceId: string, storeId: string, itemId: string, tx?: any) {
        const db = tx || prisma;
        return db.inventoryTransactionItem.findMany({
            where: {
                transaction: {
                    referenceId,
                    type: 'TRANSFER_OUT',
                    storeId
                },
                itemId
            }
        });
    }
}
