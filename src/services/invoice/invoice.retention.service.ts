import { prisma } from '@/lib/prisma';
import { RetentionReleaseResult } from './invoice-types';

export class InvoiceRetentionService {
    /**
     * Process all eligible retention releases
     */
    static async processAutoReleases(): Promise<RetentionReleaseResult[]> {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const holdInvoices = await prisma.invoice.findMany({
            where: {
                statusB: 'HOLD',
                createdAt: { lte: sixMonthsAgo }
            } as any,
            include: {
                sods: { select: { hoPatStatus: true, soNum: true } }
            } as any
        });

        const results: RetentionReleaseResult[] = [];

        for (const invoice of holdInvoices) {
            const sods = (invoice as any).sods || [];
            if (sods.length === 0) continue;

            const allPassed = sods.every((s: any) => s.hoPatStatus === 'PASS');
            const anyRejected = sods.some((s: any) => s.hoPatStatus === 'REJECTED');

            if (allPassed) {
                await prisma.invoice.update({
                    where: { id: invoice.id },
                    data: { statusB: 'ELIGIBLE' } as any
                });
                results.push({ invoiceNumber: invoice.invoiceNumber, status: 'RELEASED' });
            } else {
                results.push({ 
                    invoiceNumber: invoice.invoiceNumber, 
                    status: 'STILL_HOLD', 
                    reason: anyRejected ? 'Contains PAT Rejections' : 'Pending HO PAT Approvals'
                });
            }
        }

        return results;
    }
}
