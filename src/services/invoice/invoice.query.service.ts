import { prisma } from '@/lib/prisma';

export class InvoiceQueryService {
    /**
     * Get Service Orders eligible for invoicing for a specific period
     */
    static async getEligibleSods(contractorId: string, month: number, year: number) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);

        return await prisma.serviceOrder.findMany({
            where: {
                contractorId,
                sltsStatus: 'COMPLETED',
                sltsPatStatus: 'PASS',
                completedDate: { gte: startDate, lte: endDate },
                invoiced: false
            },
            include: {
                opmc: true
            }
        });
    }

    /**
     * Group SODs by OPMC
     */
    static groupByRegion(sods: any[]) {
        const groups: Record<string, any[]> = {};
        for (const sod of sods) {
            const opmcId = sod.opmcId;
            if (!groups[opmcId]) groups[opmcId] = [];
            groups[opmcId].push(sod);
        }
        return groups;
    }
}
