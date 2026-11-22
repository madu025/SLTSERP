import { prisma } from '@/lib/prisma';
import { SOD_INVOICE_REF } from '@/lib/payment-voucher-access';
import { trackInvoice } from '@/lib/invoice-tracker';
import { AppError } from '@/lib/error';
import { claimMonthLabel, retentionPercent } from '@/lib/contractor-claim-display';

export class ContractorFinanceService {
    static async getFinanceDashboard(userId: string | null, contractorId: string | null) {
        const currentUser = userId
            ? await prisma.user.findUnique({
                where: { id: userId },
                select: { contractorId: true }
            })
            : null;

        // Contractor identity is the relational contractorId, not the legacy
        // User.role label. A role string must never widen or change portal scope.
        const isContractorUser = Boolean(currentUser?.contractorId);
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
                awaitingYourConfirmationCount: 0,
                claims: []
            };
        }

        // Query real Invoices from Database
        const invoices = await prisma.invoice.findMany({
            where: { contractorId },
            include: {
                sods: {
                    select: { id: true, contractorAmount: true, revenueAmount: true }
                },
                sodRemovals: { select: { soNum: true, reason: true } }
            },
            orderBy: { date: 'desc' }
        });

        // where each invoice is on its way to payment (the payment vouchers of the invoices tell the last steps)
        const vouchers = invoices.length ? await prisma.paymentVoucher.findMany({
            where: { OR: invoices.map((i) => ({ description: { startsWith: `${SOD_INVOICE_REF}${i.id}` } })), status: { not: 'CANCELLED' } },
            select: { description: true, status: true, createdAt: true, submittedToHoAt: true, hoPaidDate: true },
        }) : [];
        const voucherOf = (id: string) => {
            const mine = vouchers.filter((v) => (v.description ?? '').startsWith(`${SOD_INVOICE_REF}${id}`));
            if (mine.length === 0) return { exists: false };
            return { exists: true, createdAt: mine.map((v) => v.createdAt).sort()[0], submittedToHoAt: mine.map((v) => v.submittedToHoAt).filter(Boolean).sort()[0] ?? null, paid: mine.every((v) => v.status === 'PAID'), hoPaidDate: mine.map((v) => v.hoPaidDate).filter(Boolean).sort().slice(-1)[0] ?? null };
        };

        let totalClaimedLkr = 0;
        let totalPaidLkr = 0;
        let retentionHeldLkr = 0;
        let pendingVouchersCount = 0;
        let awaitingYourConfirmationCount = 0;

        const claims = invoices.map(inv => {
            const gross = Number(inv.totalAmount || inv.amount || 0);
            const retention = Number(inv.amountB || gross * 0.05);
            const net = gross - retention;

            totalClaimedLkr += gross;
            if (inv.status === 'PAID' || inv.statusA === 'PAID') {
                totalPaidLkr += Number(inv.amountA || net);
            }
            retentionHeldLkr += retention;

            if (inv.confirmStage === 'CONTRACTOR') awaitingYourConfirmationCount += 1;
            if (inv.status === 'PENDING' || inv.status === 'AUDITED') {
                pendingVouchersCount += 1;
            }

            const monthName = claimMonthLabel(inv);

            return {
                id: inv.id,
                month: monthName,
                claimNumber: inv.invoiceNumber,
                sodCount: inv.sods.length,
                amountLkr: gross,
                status: inv.status || 'PENDING',
                confirmStage: inv.confirmStage,
                tracker: trackInvoice(inv, voucherOf(inv.id)),
                removedSods: inv.sodRemovals,
                grossLkr: gross,
                retentionLkr: retention,
                retentionPercent: retentionPercent(gross, retention),
                netLkr: net
            };
        });

        return {
            totalClaimedLkr,
            totalPaidLkr,
            retentionHeldLkr,
            pendingVouchersCount,
            awaitingYourConfirmationCount,
            claims
        };
    }
}
