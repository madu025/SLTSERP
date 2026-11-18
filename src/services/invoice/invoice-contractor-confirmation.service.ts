import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { planContractorConfirmation } from '@/lib/invoice-contractor-confirm-rules';
import { NotificationService } from '@/services/notification';

/**
 * The contractor's own review of a new invoice. Confirming moves it into the OSP Quality (SF Audit) queue; disputing
 * holds it, with the reason, until the office corrects it and sends it back.
 */
export class InvoiceContractorConfirmationService {
    /** The contractor reviews its own invoice. Identity is the signed-in user's contractor, never a client-supplied id. */
    static async respond(userId: string, invoiceId: string, action: 'CONFIRM' | 'DISPUTE', note?: string) {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { contractorId: true, name: true } });
        if (!user?.contractorId) throw AppError.forbidden('Only a contractor account can confirm an invoice');

        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            select: { id: true, invoiceNumber: true, totalAmount: true, contractorId: true, contractorConfirmStatus: true, contractor: { select: { name: true, opmcId: true } } },
        });
        if (!invoice) throw AppError.notFound('Invoice not found');

        const plan = planContractorConfirmation({ state: invoice.contractorConfirmStatus, action, isOwnInvoice: invoice.contractorId === user.contractorId, note });
        if (!plan.ok) throw AppError.badRequest(plan.message);

        const reason = note?.trim() || null;
        // The state is part of the filter, so two quick presses (or two people of the same contractor) can only win once
        const changed = await prisma.invoice.updateMany({
            where: { id: invoice.id, contractorConfirmStatus: 'AWAITING' },
            data: { contractorConfirmStatus: plan.next, contractorConfirmedAt: new Date(), contractorConfirmedById: userId, contractorNote: reason },
        });
        if (changed.count === 0) throw AppError.conflict('This invoice was already answered');
        await prisma.auditLog.create({
            data: {
                action: action === 'CONFIRM' ? 'INVOICE_CONTRACTOR_CONFIRMED' : 'INVOICE_CONTRACTOR_DISPUTED',
                entity: 'Invoice', entityId: invoice.id, userId,
                newValue: { invoiceNumber: invoice.invoiceNumber, contractor: invoice.contractor?.name, note: reason },
            },
        });

        const opmcId = invoice.contractor?.opmcId ?? undefined;
        if (action === 'CONFIRM') {
            await NotificationService.notifyByAudience({
                audience: 'FINANCE_APPROVERS', type: 'FINANCE', priority: 'MEDIUM', link: '/finance/sf-audit/queue', opmcId,
                title: 'Invoice ready for OSP Quality',
                message: `${invoice.contractor?.name ?? 'The contractor'} confirmed invoice ${invoice.invoiceNumber}. It is waiting for verification.`,
                metadata: { id: invoice.id },
            });
        } else {
            await NotificationService.notifyByAudience({
                audience: 'SOD_PROJECT', type: 'FINANCE', priority: 'HIGH', link: '/invoices', opmcId,
                title: 'Invoice disputed by the contractor',
                message: `${invoice.contractor?.name ?? 'The contractor'} disputed invoice ${invoice.invoiceNumber}: ${reason}`,
                metadata: { id: invoice.id },
            });
        }
        return { invoiceNumber: invoice.invoiceNumber, contractorConfirmStatus: plan.next };
    }

    /** The office corrected a disputed invoice and sends it back to the contractor for a new review. */
    static async resend(userId: string, invoiceId: string) {
        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            select: { id: true, invoiceNumber: true, contractorConfirmStatus: true, contractor: { select: { opmcId: true } } },
        });
        if (!invoice) throw AppError.notFound('Invoice not found');
        const scope = await resolveOpmcScope(userId);
        if (scope !== undefined && (!invoice.contractor?.opmcId || !scope.includes(invoice.contractor.opmcId))) throw AppError.forbidden('This invoice is outside your area');
        const plan = planContractorConfirmation({ state: invoice.contractorConfirmStatus, action: 'RESEND', isOwnInvoice: false });
        if (!plan.ok) throw AppError.badRequest(plan.message);

        const changed = await prisma.invoice.updateMany({
            where: { id: invoice.id, contractorConfirmStatus: 'DISPUTED' },
            data: { contractorConfirmStatus: 'AWAITING', contractorConfirmedAt: null, contractorConfirmedById: null },
        });
        if (changed.count === 0) throw AppError.conflict('This invoice is no longer disputed');
        await prisma.auditLog.create({ data: { action: 'INVOICE_SENT_BACK_TO_CONTRACTOR', entity: 'Invoice', entityId: invoice.id, userId, newValue: { invoiceNumber: invoice.invoiceNumber } } });
        return { invoiceNumber: invoice.invoiceNumber, contractorConfirmStatus: 'AWAITING' as const };
    }

    /** Invoices the contractor confirmed (and the area chain cleared) that wait for OSP Quality, inside the caller's OPMC scope. */
    static async ospQualityQueue(userId: string) {
        const scope = await resolveOpmcScope(userId);
        const scopeWhere = scope !== undefined ? { contractor: { opmcId: { in: [...scope] } } } : {};
        const [ready, awaitingContractor, disputed] = await Promise.all([
            prisma.invoice.findMany({
                where: { statusA: 'PENDING_SF_AUDIT', confirmStage: 'CONFIRMED', contractorConfirmStatus: 'CONFIRMED', ...scopeWhere },
                orderBy: { createdAt: 'asc' },
                take: 300,
                select: {
                    id: true, invoiceNumber: true, totalAmount: true, amountA: true, amountB: true, month: true, year: true, rtomArea: true,
                    contractorConfirmedAt: true, createdAt: true, contractor: { select: { name: true } }, _count: { select: { sods: true } },
                },
            }),
            prisma.invoice.count({ where: { statusA: 'PENDING_SF_AUDIT', contractorConfirmStatus: 'AWAITING', ...scopeWhere } }),
            prisma.invoice.count({ where: { statusA: 'PENDING_SF_AUDIT', contractorConfirmStatus: 'DISPUTED', ...scopeWhere } }),
        ]);
        return { ready, awaitingContractor, disputed };
    }
}
