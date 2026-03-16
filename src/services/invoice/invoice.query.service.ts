import { prisma } from '@/lib/prisma';
import { SODWithOPMC, RegionalInvoiceGroup } from './invoice-types';

export class InvoiceQueryService {
    /**
     * Get Service Orders eligible for invoicing for a specific period
     */
    static async getEligibleSods(contractorId: string, month: number, year: number): Promise<SODWithOPMC[]> {
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
    static groupByRegion(sods: SODWithOPMC[]): RegionalInvoiceGroup {
        const groups: RegionalInvoiceGroup = {};
        for (const sod of sods) {
            const opmcId = sod.opmcId;
            if (!groups[opmcId]) groups[opmcId] = [];
            groups[opmcId].push(sod);
        }
        return groups;
    }
}
