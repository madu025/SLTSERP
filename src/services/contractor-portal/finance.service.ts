import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';

export class ContractorFinanceService {
    static async getFinanceDashboard(userId: string | null, contractorId: string | null) {
        const currentUser = userId
            ? await prisma.user.findUnique({
                where: { id: userId },
                select: { contractorId: true, role: true }
            })
            : null;

        const isContractorUser = currentUser?.role?.startsWith('CONTRACTOR_') === true;
        if (isContractorUser) {
            if (contractorId && contractorId !== currentUser?.contractorId) {
                throw AppError.forbidden('Contractor finance access is limited to the signed-in contractor');
            }
            contractorId = currentUser?.contractorId || null;
        } else if (!userId) {
            // A contractor identifier supplied only by a client header is not an identity.
            contractorId = null;
        } else if (!contractorId) {
            contractorId = currentUser?.contractorId || null;
        }

        if (!contractorId) {
            return {
                totalClaimedLkr: 0,
                totalPaidLkr: 0,
                retentionHeldLkr: 0,
                pendingVouchersCount: 0,
                claims: []
            };
        }

        // Query real Invoices from Database
        const invoices = await prisma.invoice.findMany({
            where: { contractorId },
            include: {
                sods: {
                    select: { id: true, contractorAmount: true, revenueAmount: true }
                }
            },
            orderBy: { date: 'desc' }
        });

        let totalClaimedLkr = 0;
        let totalPaidLkr = 0;
        let retentionHeldLkr = 0;
        let pendingVouchersCount = 0;

        const claims = invoices.map(inv => {
            const gross = Number(inv.totalAmount || inv.amount || 0);
            const retention = Number(inv.amountB || gross * 0.05);
            const net = gross - retention;

            totalClaimedLkr += gross;
            if (inv.status === 'PAID' || inv.statusA === 'PAID') {
                totalPaidLkr += Number(inv.amountA || net);
            }
            retentionHeldLkr += retention;

            if (inv.status === 'PENDING' || inv.status === 'AUDITED') {
                pendingVouchersCount += 1;
            }

            const monthName = inv.date ? new Date(inv.date).toLocaleString('default', { month: 'long', year: 'numeric' }) : 'July 2026';

            return {
                id: inv.id,
                month: monthName,
                claimNumber: inv.invoiceNumber,
                sodCount: inv.sods.length,
                amountLkr: gross,
                status: inv.status || 'PENDING',
                grossLkr: gross,
                retentionLkr: retention,
                netLkr: net
            };
        });

        return {
            totalClaimedLkr,
            totalPaidLkr,
            retentionHeldLkr,
            pendingVouchersCount,
            claims
        };
    }
}
