import { prisma } from '@/lib/prisma';

export class ContractorFinanceService {
    static async getFinanceDashboard(userId: string | null, contractorId: string | null) {
        if (!contractorId && userId) {
            const currentUser = await prisma.user.findUnique({
                where: { id: userId },
                select: { contractorId: true }
            });
            contractorId = currentUser?.contractorId || null;
        }

        if (!contractorId) {
            const activeContractor = await prisma.contractor.findFirst({
                where: { status: 'ACTIVE' },
                select: { id: true }
            });
            contractorId = activeContractor?.id || null;
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
        let invoices = await prisma.invoice.findMany({
            where: { contractorId },
            include: {
                sods: {
                    select: { id: true, contractorAmount: true, revenueAmount: true }
                }
            },
            orderBy: { date: 'desc' }
        });

        // If no invoice exists yet, auto-create a real Invoice in PostgreSQL linked to completed SODs
        if (invoices.length === 0) {
            const completedSods = await prisma.serviceOrder.findMany({
                where: {
                    contractorId,
                    status: { in: ['COMPLETED', 'INSTALL_CLOSED'] }
                },
                select: { id: true, contractorAmount: true, revenueAmount: true }
            });

            if (completedSods.length > 0) {
                const calculatedTotal = completedSods.reduce((sum, s) => sum + (s.contractorAmount ? Number(s.contractorAmount) : 15000), 0);
                const claimNo = `CLM-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;


                const newInvoice = await prisma.invoice.create({
                    data: {
                        invoiceNumber: claimNo,
                        contractorId,
                        totalAmount: calculatedTotal,
                        amountA: calculatedTotal * 0.8,
                        amountB: calculatedTotal * 0.2,
                        amount: calculatedTotal,
                        status: 'AUDITED',
                        statusA: 'APPROVED',
                        statusB: 'HOLD',
                        date: new Date(),
                        sods: {
                            connect: completedSods.map(s => ({ id: s.id }))
                        }
                    },
                    include: {
                        sods: { select: { id: true, contractorAmount: true, revenueAmount: true } }
                    }
                });

                invoices = [newInvoice];
            }
        }

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
