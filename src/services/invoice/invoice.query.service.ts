import { prisma } from '@/lib/prisma';
import { SODWithOPMC, RegionalInvoiceGroup } from '@/types/finance/invoice-service.types';

export class InvoiceQueryService {
    /**
     * Get Service Orders eligible for invoicing for a specific period
     */
    static async getEligibleSods(contractorId: string, month: number, year: number): Promise<SODWithOPMC[]> {
        const startDate = new Date(Date.UTC(year, month - 1, 1));
        const endDate = new Date(Date.UTC(year, month, 1));

        return await prisma.serviceOrder.findMany({
            where: {
                contractorId,
                OR: [
                    { status: { in: ['COMPLETED', 'INSTALL_CLOSED'] } },
                    { sltsStatus: 'COMPLETED' }
                ],
                completedDate: { gte: startDate, lt: endDate },
                isInvoicable: true,
                invoiced: false,
                invoiceId: null
            },
            include: {
                opmc: true,
                materialUsage: {
                    include: {
                        item: true
                    }
                }
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
