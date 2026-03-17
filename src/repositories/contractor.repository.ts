/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@/lib/prisma';
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
        // Lock rows for update
        await tx.$executeRaw`SELECT id FROM "ContractorBatchStock" WHERE "contractorId" = ${contractorId} AND "itemId" = ${itemId} AND "quantity" > 0 FOR UPDATE`;

        return tx.contractorBatchStock.findMany({
            where: { contractorId, itemId, quantity: { gt: 0 } },
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
}
