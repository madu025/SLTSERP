/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

/**
 * ServiceOrderRepository
 * ----------------------
 * Handles all direct database interactions for Service Orders.
 * This is the first step towards the Service-Repository Pattern.
 */
export class ServiceOrderRepository {
    
    /**
     * Find a single Service Order by its unique SO Number
     */
    static async findBySoNum(soNum: string, include?: any) {
        return prisma.serviceOrder.findUnique({
            where: { soNum },
            include
        });
    }

    /**
     * Update an existing Service Order
     */
    static async update(id: string, data: Prisma.ServiceOrderUncheckedUpdateInput) {
        return prisma.serviceOrder.update({
            where: { id },
            data
        });
    }

    /**
     * Create a new Service Order
     */
    static async create(data: Prisma.ServiceOrderUncheckedCreateInput) {
        return prisma.serviceOrder.create({
            data
        });
    }

    /**
     * Upsert a Service Order (Create or Update based on soNum)
     */
    static async upsert(soNum: string, data: Prisma.ServiceOrderUncheckedCreateInput) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, ...rest } = data;
        return prisma.serviceOrder.upsert({
            where: { soNum },
            update: rest,
            create: data
        });
    }

    /**
     * Generic Query with filters
     */
    static async findMany(args: any) {
        return prisma.serviceOrder.findMany(args);
    }

    /**
     * Count matching records
     */
    static async count(args: any) {
        return prisma.serviceOrder.count(args);
    }
}
