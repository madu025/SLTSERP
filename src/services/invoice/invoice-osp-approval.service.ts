import { notifyContractorUsers } from '@/services/invoice/invoice-contractor-notify';
import type { InvoiceStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { NotificationService } from '@/services/notification';
import { OSP_PENDING, planOspStep, type OspAction } from '@/lib/invoice-osp-approval-rules';

const MAX_BATCH = 200;

export interface OspOutcome { invoiceNumber: string; message?: string }

const SELECT = {
    id: true, invoiceNumber: true, totalAmount: true, amountA: true, amountB: true, month: true, year: true, rtomArea: true,
    approvalFlow: true, approvalStatus: true, statusA: true, status: true, contractorConfirmStatus: true, confirmStage: true,
    ospSentAt: true, ospSentById: true, ospDecisionAt: true, ospNote: true, createdAt: true,
    contractorId: true, contractor: { select: { name: true, opmcId: true } }, _count: { select: { sods: true } },
} as const;

/**
 * Verified contractor invoices: Finance lists them and sends them to the OSP managers, an OSP manager approves (or returns
 * them with a reason), and an approved invoice is picked up by the existing Head Office payment run.
 */
export class InvoiceOspApprovalService {
    private static inScope(scope: string[] | undefined, opmcId: string | null | undefined) {
        return scope === undefined || (!!opmcId && scope.includes(opmcId));
    }

    private static async scopeWhere(userId: string) {
        const scope = await resolveOpmcScope(userId, 'finance');
        return { scope, where: scope !== undefined ? { contractor: { opmcId: { in: [...scope] } } } : {} };
    }

    /** What Finance sees: verified invoices ready to send, the ones with the OSP managers, and the approved ones on their way to Head Office. */
    static async financeBoard(userId: string) {
        const { where } = await this.scopeWhere(userId);
        const base = { approvalFlow: 'OSP_CHAIN', statusA: { in: ['SF_AUDIT_APPROVED', 'PAID'] as InvoiceStatus[] }, ...where };
        const [ready, withManagers, approved, beforeVerify] = await Promise.all([
            prisma.invoice.findMany({ where: { ...base, approvalStatus: 'DRAFT' }, orderBy: { createdAt: 'asc' }, take: 300, select: SELECT }),
            prisma.invoice.findMany({ where: { ...base, approvalStatus: OSP_PENDING }, orderBy: { ospSentAt: 'asc' }, take: 300, select: SELECT }),
            prisma.invoice.findMany({ where: { ...base, approvalStatus: 'APPROVED' }, orderBy: { ospDecisionAt: 'desc' }, take: 100, select: SELECT }),
            prisma.invoice.count({ where: { approvalFlow: 'OSP_CHAIN', statusA: 'PENDING_SF_AUDIT', ...where } }),
        ]);
        // Where each approved invoice stands with Head Office: its payment requests and the Head Office reference once paid
        const vouchers = approved.length === 0 ? [] : await prisma.paymentVoucher.findMany({
            where: { OR: approved.map((i) => ({ description: { startsWith: `BOM_INVOICING_REF:${i.id}` } })), status: { notIn: ['CANCELLED', 'REJECTED'] } },
            select: { description: true, pvNumber: true, status: true, amount: true, hoReference: true, hoPaidDate: true },
            orderBy: { createdAt: 'asc' },
        });
        const headOffice = approved.map((i) => ({
            ...i,
            vouchers: vouchers.filter((v) => (v.description ?? '').startsWith(`BOM_INVOICING_REF:${i.id}`)).map((v) => ({ pvNumber: v.pvNumber, status: v.status, amount: Number(v.amount), hoReference: v.hoReference, hoPaidDate: v.hoPaidDate })),
        }));
        return { ready, withManagers, approved: headOffice, beforeVerify };
    }

    static async managerQueue(userId: string) {
        const { where } = await this.scopeWhere(userId);
        return prisma.invoice.findMany({ where: { approvalFlow: 'OSP_CHAIN', approvalStatus: OSP_PENDING, ...where }, orderBy: { ospSentAt: 'asc' }, take: 300, select: SELECT });
    }

    /** One generic loop: each invoice is judged on its own and the answer lists the ones that moved and the ones that could not. */
    private static async run(userId: string, ids: string[], action: OspAction, note?: string) {
        const unique = [...new Set(ids)];
        if (unique.length === 0) throw AppError.badRequest('Select at least one invoice');
        if (unique.length > MAX_BATCH) throw AppError.badRequest(`At most ${MAX_BATCH} invoices at a time`);
        if (action === 'RETURN' && (note?.trim().length ?? 0) < 3) throw AppError.badRequest('A reason is required to return an invoice');
        const scope = await resolveOpmcScope(userId, 'finance');
        const invoices = await prisma.invoice.findMany({ where: { id: { in: unique } }, select: SELECT });
        const done: OspOutcome[] = [];
        const failed: OspOutcome[] = [];
        for (const id of unique) if (!invoices.some((i) => i.id === id)) failed.push({ invoiceNumber: id, message: 'Invoice not found' });

        const reason = note?.trim() || null;
        const now = new Date();
        for (const inv of invoices) {
            if (!this.inScope(scope, inv.contractor?.opmcId)) { failed.push({ invoiceNumber: inv.invoiceNumber, message: 'This invoice is outside your area' }); continue; }
            const plan = planOspStep({ invoice: inv, action, actorId: userId, note });
            if (!plan.ok) { failed.push({ invoiceNumber: inv.invoiceNumber, message: plan.message }); continue; }

            const data =
                action === 'SEND' ? { approvalStatus: plan.next, ospSentAt: now, ospSentById: userId, ospDecisionAt: null, ospDecisionById: null, ospNote: null }
                    : action === 'APPROVE' ? { approvalStatus: plan.next, status: 'APPROVED' as const, ospDecisionAt: now, ospDecisionById: userId, ospNote: reason }
                        : { approvalStatus: plan.next, ospDecisionAt: now, ospDecisionById: userId, ospNote: reason, ospSentAt: null, ospSentById: null };
            // The state is part of the filter, so two people pressing at once can only win once
            const changed = await prisma.invoice.updateMany({ where: { id: inv.id, approvalStatus: inv.approvalStatus, approvalFlow: 'OSP_CHAIN' }, data });
            if (changed.count === 0) { failed.push({ invoiceNumber: inv.invoiceNumber, message: 'This invoice was changed by someone else; reload and try again' }); continue; }
            await prisma.auditLog.create({
                data: {
                    action: action === 'SEND' ? 'INVOICE_SENT_TO_OSP_MANAGERS' : action === 'APPROVE' ? 'INVOICE_OSP_APPROVED' : 'INVOICE_OSP_RETURNED',
                    entity: 'Invoice', entityId: inv.id, userId, newValue: { invoiceNumber: inv.invoiceNumber, totalAmount: Number(inv.totalAmount), note: reason },
                },
            });
            done.push({ invoiceNumber: inv.invoiceNumber });
            if (action === 'APPROVE') await notifyContractorUsers(inv.contractorId, { invoiceId: inv.id, step: 'OSP_APPROVED', title: 'Invoice approved for payment', message: `Invoice ${inv.invoiceNumber} is approved by the OSP managers. Finance prepares the payment and sends it to Head Office.` });
        }

        if (done.length > 0) await this.notify(action, done.length, invoices.filter((i) => done.some((d) => d.invoiceNumber === i.invoiceNumber)), reason);
        return { done, failed };
    }

    private static async notify(action: OspAction, count: number, invoices: Array<{ contractor: { opmcId: string | null } | null }>, reason: string | null) {
        const opmcId = invoices.length === 1 ? invoices[0].contractor?.opmcId ?? undefined : undefined;
        const plural = `${count} invoice${count === 1 ? '' : 's'}`;
        if (action === 'SEND') {
            await NotificationService.notifyByAudience({ audience: 'PROCESS_GATE_OSP_MANAGER', type: 'FINANCE', priority: 'HIGH', link: '/invoices/osp-approvals', opmcId, title: 'Invoices waiting for OSP manager approval', message: `Finance sent ${plural} for your approval.` });
        } else if (action === 'APPROVE') {
            await NotificationService.notifyByAudience({ audience: 'FINANCE_APPROVERS', type: 'FINANCE', priority: 'MEDIUM', link: '/finance/invoice-dispatch', opmcId, title: 'Invoices approved by OSP managers', message: `${plural} approved. They can now go to Head Office for payment.` });
        } else {
            await NotificationService.notifyByAudience({ audience: 'FINANCE_APPROVERS', type: 'FINANCE', priority: 'HIGH', link: '/finance/invoice-dispatch', opmcId, title: 'Invoices returned by OSP managers', message: `${plural} returned: ${reason}` });
        }
    }

    static send(userId: string, ids: string[]) { return this.run(userId, ids, 'SEND'); }
    static approve(userId: string, ids: string[]) { return this.run(userId, ids, 'APPROVE'); }
    static returnToFinance(userId: string, ids: string[], note: string) { return this.run(userId, ids, 'RETURN', note); }
}
