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
     * Find a single Service Order by its unique ID
     */
    static async findById(id: string, include?: any, tx?: any) {
        const db = tx || prisma;
        return db.serviceOrder.findUnique({
            where: { id },
            include
        });
    }

    /**
     * Find a single Service Order by its unique SO Number
     */
    static async findBySoNum(soNum: string, include?: any, tx?: any) {
        const db = tx || prisma;
        return db.serviceOrder.findUnique({
            where: { soNum },
            include
        });
    }

    /**
     * Find first matching record
     */
    static async findFirst(args: Prisma.ServiceOrderFindFirstArgs, tx?: any) {
        const db = tx || prisma;
        return db.serviceOrder.findFirst(args);
    }

    /**
     * Update an existing Service Order
     */
    static async update(id: string, data: Prisma.ServiceOrderUncheckedUpdateInput, tx?: any) {
        const db = tx || prisma;
        return db.serviceOrder.update({
            where: { id },
            data
        });
    }

    /**
     * Create a new Service Order
     */
    static async create(data: Prisma.ServiceOrderUncheckedCreateInput, tx?: any) {
        const db = tx || prisma;
        return db.serviceOrder.create({
            data
        });
    }

    /**
     * Upsert a Service Order (Create or Update based on soNum)
     */
    static async upsert(soNum: string, data: Prisma.ServiceOrderUncheckedCreateInput, tx?: any) {
        const db = tx || prisma;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, ...rest } = data;
        return db.serviceOrder.upsert({
            where: { soNum },
            update: rest,
            create: data
        });
    }

    /**
     * Generic Query with filters
     */
    static async findMany(args: Prisma.ServiceOrderFindManyArgs, tx?: any) {
        const db = tx || prisma;
        return db.serviceOrder.findMany(args);
    }

    /**
     * Count matching records
     */
    static async count(args: Prisma.ServiceOrderCountArgs, tx?: any) {
        const db = tx || prisma;
        return db.serviceOrder.count(args);
    }
}
