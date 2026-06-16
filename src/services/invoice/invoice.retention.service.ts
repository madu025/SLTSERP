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
            },
            include: {
                sods: { select: { hoPatStatus: true, soNum: true } }
            }
        });

        const results: RetentionReleaseResult[] = [];

        for (const invoice of holdInvoices) {
            const sods = invoice.sods || [];
            if (sods.length === 0) continue;

            const allPassed = sods.every((s) => s.hoPatStatus === 'PASS');
            const anyRejected = sods.some((s) => s.hoPatStatus === 'REJECTED');

            if (allPassed) {
                await prisma.invoice.update({
                    where: { id: invoice.id },
                    data: { statusB: 'ELIGIBLE' }
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
