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
     * Delete all usage records for a Service Order
     */
    static async deleteByServiceOrderId(serviceOrderId: string, tx: any) {
        return (tx as any).sODMaterialUsage.deleteMany({
            where: { serviceOrderId }
        });
    }

    /**
     * Create multiple usage records
     */
    static async createMany(data: Prisma.SODMaterialUsageUncheckedCreateWithoutServiceOrderInput[], tx: any) {
        // createMany is not always available on all tx objects depending on version/extensions
        // but for standard Prisma it is.
        return (tx as any).sODMaterialUsage.createMany({
            data
        });
    }
}
