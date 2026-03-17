/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@/lib/prisma';

export class ContractorRepository {
    /**
     * Find a contractor by ID
     */
    static async findById(id: string, tx?: any) {
        const client = tx || prisma;
        return (client as any).contractor.findUnique({
            where: { id }
        });
    }

    /**
     * Find contractor batch stock with mapping to global batch
     */
    static async findAvailableBatches(contractorId: string, itemId: string, tx: any) {
        // Lock rows for update
        await (tx as any).$executeRaw`SELECT id FROM "ContractorBatchStock" WHERE "contractorId" = ${contractorId} AND "itemId" = ${itemId} AND "quantity" > 0 FOR UPDATE`;

        return (tx as any).contractorBatchStock.findMany({
            where: { contractorId, itemId, quantity: { gt: 0 } },
            include: { batch: true },
            orderBy: { batch: { createdAt: 'asc' } }
        });
    }

    /**
     * Update contractor batch stock
     */
    static async updateBatchStock(contractorId: string, batchId: string, quantity: number, tx: any) {
        return (tx as any).contractorBatchStock.update({
            where: { contractorId_batchId: { contractorId, batchId } },
            data: { quantity: { increment: quantity } }
        });
    }

    /**
     * Upsert contractor global stock
     */
    static async upsertStock(contractorId: string, itemId: string, quantity: number, tx: any) {
        return (tx as any).contractorStock.upsert({
            where: { contractorId_itemId: { contractorId, itemId } },
            create: { contractorId, itemId, quantity },
            update: { quantity: { increment: quantity } }
        });
    }

    /**
     * Get OPMC details including store link
     */
    static async findOpmcWithStore(opmcId: string, tx?: any) {
        const client = tx || prisma;
        return (client as any).oPMC.findUnique({
            where: { id: opmcId },
            select: { id: true, storeId: true, rtom: true }
        });
    }
}
