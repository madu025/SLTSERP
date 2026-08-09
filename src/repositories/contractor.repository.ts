/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@/lib/prisma';
import { AppError, ErrorCode } from '@/lib/error';
import { Prisma } from '@prisma/client';

export class ContractorRepository {
    /**
     * Find a contractor by ID
     */
    static async findById(id: string, tx?: any) {
        const client = tx || prisma;
        return client.contractor.findUnique({
            where: { id }
        });
    }

    /**
     * Find contractor batch stock with mapping to global batch
     */
    static async findAvailableBatches(contractorId: string, itemId: string, tx: any) {
        return tx.contractorBatchStock.findMany({
            where: { contractorId, itemId, quantity: { gt: 0 } },
            include: { batch: true },
            orderBy: { batch: { createdAt: 'asc' } }
        });
    }

    /**
     * Find available batches for multiple items in bulk (FIFO order with bulk locking)
     */
    static async findAvailableBatchesBulk(contractorId: string, itemIds: string[], tx: any) {
        if (itemIds.length === 0) return [];
        return tx.contractorBatchStock.findMany({
            where: { contractorId, itemId: { in: itemIds }, quantity: { gt: 0 } },
            include: { batch: true },
            orderBy: { batch: { createdAt: 'asc' } }
        });
    }

    /**
     * Update contractor batch stock
     */
    static async updateBatchStock(contractorId: string, batchId: string, quantity: number, tx: any) {
        return tx.contractorBatchStock.update({
            where: { contractorId_batchId: { contractorId, batchId } },
            data: { quantity: { increment: quantity } }
        });
    }

    /**
     * Upsert contractor global stock
     */
    static async upsertStock(contractorId: string, itemId: string, quantity: number, tx: any) {
        return tx.contractorStock.upsert({
            where: { contractorId_itemId: { contractorId, itemId } },
            create: { contractorId, itemId, quantity },
            update: { quantity: { increment: quantity } }
        });
    }

    /**
     * Atomic Decrement for Contractor Stock (Prevents Negative Stock)
     */
    static async decrementStockAtomic(contractorId: string, itemId: string, quantity: number, tx: any) {
        const stock = await (tx as any).contractorStock.findUnique({
            where: { contractorId_itemId: { contractorId, itemId } }
        });
        if (!stock || stock.quantity < quantity) {
            throw new AppError(`Insufficient physical stock for item ${itemId} in contractor store ${contractorId}`, ErrorCode.INSUFFICIENT_STOCK, 400);
        }
        return (tx as any).contractorStock.update({
            where: { contractorId_itemId: { contractorId, itemId } },
            data: { quantity: { decrement: quantity } }
        });
    }

    /**
     * Atomic Decrement for Contractor Batch Stock
     */
    static async decrementBatchStockAtomic(contractorId: string, batchId: string, quantity: number, tx: any) {
        const stock = await (tx as any).contractorBatchStock.findUnique({
            where: { contractorId_batchId: { contractorId, batchId } }
        });
        if (!stock || stock.quantity < quantity) {
            throw new AppError(`Insufficient physical batch stock for batch ${batchId} in contractor store ${contractorId}`, ErrorCode.INSUFFICIENT_STOCK, 400);
        }
        return (tx as any).contractorBatchStock.update({
            where: { contractorId_batchId: { contractorId, batchId } },
            data: { quantity: { decrement: quantity } }
        });
    }

    /**
     * Get OPMC details including store link
     */
    static async findOpmcWithStore(opmcId: string, tx?: any) {
        const client = tx || prisma;
        return client.oPMC.findUnique({
            where: { id: opmcId },
            select: { id: true, storeId: true, rtom: true }
        });
    }

    /**
     * Find many contractors
     */
    static async findMany(args: Prisma.ContractorFindManyArgs, tx?: any) {
        const client = tx || prisma;
        return client.contractor.findMany(args);
    }

    /**
     * Count contractors
     */
    static async count(args: Prisma.ContractorCountArgs, tx?: any) {
        const client = tx || prisma;
        return client.contractor.count(args);
    }

    /**
     * Create contractor
     */
    static async create(data: Prisma.ContractorUncheckedCreateInput, tx?: any) {
        const client = tx || prisma;
        return client.contractor.create({ data });
    }

    /**
     * Update contractor
     */
    static async update(id: string, data: Prisma.ContractorUncheckedUpdateInput, tx?: any) {
        const client = tx || prisma;
        return client.contractor.update({
            where: { id },
            data
        });
    }

    /**
     * Delete contractor
     */
    static async delete(id: string, tx?: any) {
        const client = tx || prisma;
        return client.contractor.delete({ where: { id } });
    }

    /**
     * Team Management
     */
    static async createTeam(data: Prisma.ContractorTeamUncheckedCreateInput, tx?: any) {
        const client = tx || prisma;
        return client.contractorTeam.create({ data });
    }

    static async updateTeam(id: string, data: Prisma.ContractorTeamUncheckedUpdateInput, tx?: any) {
        const client = tx || prisma;
        return client.contractorTeam.update({
            where: { id },
            data
        });
    }

    static async deleteTeams(where: Prisma.ContractorTeamWhereInput, tx?: any) {
        const client = tx || prisma;
        return client.contractorTeam.deleteMany({ where });
    }

    /**
     * Member Management
     */
    static async deleteTeamMembers(teamId: string, tx?: any) {
        const client = tx || prisma;
        return client.teamMember.deleteMany({ where: { teamId } });
    }

    static async createTeamMembers(data: Prisma.TeamMemberCreateManyInput[], tx?: any) {
        const client = tx || prisma;
        return client.teamMember.createMany({ data });
    }

    static async findTeamsByContractorId(contractorId: string, tx?: any) {
        const client = tx || prisma;
        return client.contractorTeam.findMany({
            where: { contractorId },
            select: { id: true }
        });
    }

    static async findContractorWithCounts(id: string, tx?: any) {
        const client = tx || prisma;
        return client.contractor.findUnique({
            where: { id },
            select: {
                _count: {
                    select: { serviceOrders: true, projects: true, stock: true }
                }
            }
        });
    }
}
