import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { InvoiceGeneratorService } from '@/services/invoice/invoice.generator.service';
import { resolveOpmcScope } from '@/lib/opmc-scope';
export class BillingService {
    /**
     * Generates a Draft Invoice for a specific contractor for unbilled COMPLETED Service Orders.
     * Implements FSM Settlement (Retention, Advances, WHT).
     */
    static async generateContractorInvoice(data: {
        contractorId: string;
        projectId?: string;
        description?: string;
        retentionPercent?: number; // e.g. 5 for 5%
        whtPercent?: number;       // e.g. 5 for 5%
        advanceDeduction?: number;
        month?: string | number;
        year?: string | number;
    }, userId: string) {
        if (!userId) throw AppError.unauthorized('Authenticated billing user is required');
        if (data.projectId) {
            throw AppError.badRequest('Project-specific billing is not supported by the verified monthly SOD flow');
        }
        return InvoiceGeneratorService.generateContractorMonthlyInvoice(data, userId);
    }
    static async getUnbilledSods(contractorId: string, userId: string, month?: string | number, year?: string | number) {
        if (!contractorId) {
            throw AppError.badRequest('contractorId is required');
        }
        if (!userId) throw AppError.unauthorized('Authentication required');
        const now = new Date();
        const currentYear = year ? Number(year) : now.getFullYear();
        const currentMonth = month ? Number(month) : now.getMonth() + 1;
        if (!Number.isInteger(currentYear) || !Number.isInteger(currentMonth) || currentMonth < 1 || currentMonth > 12) {
            throw AppError.badRequest('Invalid invoice period');
        }
        const accessibleOpmcs = await resolveOpmcScope(userId);
        const contractor = await prisma.contractor.findUnique({ where: { id: contractorId }, select: { opmcId: true } });
        if (!contractor) throw AppError.notFound('Contractor not found');
        if (accessibleOpmcs !== undefined && (!contractor.opmcId || !accessibleOpmcs.includes(contractor.opmcId))) {
            throw AppError.forbidden('Contractor is outside your OPMC access');
        }
        const periodStart = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
        const periodEnd = new Date(Date.UTC(currentYear, currentMonth, 1));
        const sods = await prisma.serviceOrder.findMany({
            where: {
                contractorId,
                completedDate: { gte: periodStart, lt: periodEnd },
                OR: [{ status: { in: ['COMPLETED', 'INSTALL_CLOSED'] } }, { sltsStatus: 'COMPLETED' }],
                isInvoicable: true,
                invoiceId: null,
                invoiced: false,
                ...(accessibleOpmcs !== undefined ? { opmcId: { in: accessibleOpmcs } } : {}),
            },
            select: {
                id: true,
                soNum: true,
                serviceType: true,
                completedDate: true,
                revenueAmount: true,
                contractorAmount: true
            },
            orderBy: { completedDate: 'desc' }
        });
        const totalAmount = sods.reduce((sum, sod) => sum + (sod.contractorAmount ? new Prisma.Decimal(sod.contractorAmount).toNumber() : 0), 0);
        return {
            sods,
            totalAmount,
            month: currentMonth,
            year: currentYear
        };
    }
}
