/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export class MaterialRepository {
    /**
     * Find material usage for a specific Service Order
     */
    static async findByServiceOrderId(serviceOrderId: string, tx?: any) {
        const client = tx || prisma;
        return (client as any).sODMaterialUsage.findMany({
            where: { serviceOrderId },
            include: {
                serviceOrder: {
                    select: {
                        soNum: true,
                        contractorId: true,
                        opmc: { select: { storeId: true } }
                    }
                }
            }
        });
    }

    /**
     * Delete many records
     */
    static async deleteMany(where: Prisma.SODMaterialUsageWhereInput, tx?: any) {
        const client = tx || prisma;
        return client.sODMaterialUsage.deleteMany({ where });
    }

    /**
     * Find by ID
     */
    static async findById(id: string, tx?: any) {
        const client = tx || prisma;
        return client.sODMaterialUsage.findUnique({
            where: { id }
        });
    }

    /**
     * Create multiple usage records
     */
    static async createMany(data: Prisma.SODMaterialUsageUncheckedCreateWithoutServiceOrderInput[], tx?: any) {
        const client = tx || prisma;
        return client.sODMaterialUsage.createMany({
            data
        });
    }
}
