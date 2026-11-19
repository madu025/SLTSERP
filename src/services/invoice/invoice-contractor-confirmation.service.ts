import { prisma } from '@/lib/prisma';
import { resolveOpmcScope } from '@/lib/opmc-scope';

/** The OSP Quality (SF Audit) queue: invoices that finished the area approval gate. */
export class InvoiceContractorConfirmationService {
    /** Invoices the contractor confirmed (and the area chain cleared) that wait for OSP Quality, inside the caller's OPMC scope. */
    static async ospQualityQueue(userId: string) {
        const scope = await resolveOpmcScope(userId);
        const scopeWhere = scope !== undefined ? { contractor: { opmcId: { in: [...scope] } } } : {};
        const [ready, inApproval] = await Promise.all([
            prisma.invoice.findMany({
                where: { statusA: 'PENDING_SF_AUDIT', status: { not: 'CANCELLED' }, confirmStage: 'CONFIRMED', contractorConfirmStatus: 'CONFIRMED', ...scopeWhere },
                orderBy: { createdAt: 'asc' },
                take: 300,
                select: {
                    id: true, invoiceNumber: true, totalAmount: true, amountA: true, amountB: true, month: true, year: true, rtomArea: true,
                    contractorConfirmedAt: true, createdAt: true, contractor: { select: { name: true } }, _count: { select: { sods: true } },
                },
            }),
            prisma.invoice.count({ where: { statusA: 'PENDING_SF_AUDIT', status: { not: 'CANCELLED' }, confirmStage: { notIn: ['CONFIRMED', 'CANCELLED'] }, ...scopeWhere } }),
        ]);
        return { ready, inApproval };
    }
}
