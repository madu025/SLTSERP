import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { AuditService } from '@/services/audit/audit.service';
import { AuditLedgerService } from '@/services/inventory/audit-ledger.service';
import { LedgerService } from '@/services/finance/ledger.service';
import { ACCOUNTS } from '@/services/finance/account-codes';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { canTransitionFunding, remainingAllocation, validApprovedAmount, validFundedAmount, FUNDING_PURPOSES } from '@/lib/ho-payment-rules';
import type { TransactionClient } from '@/types/inventory/inventory-service.types';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Funding is asked for by the OSP Finance Section and approved and provided by Head Office. */
export class HoFundingService {
    static async list(status?: string) {
        const rows = await prisma.hoFundingRequest.findMany({ where: status ? { status } : undefined, orderBy: { createdAt: 'desc' }, take: 200 });
        return rows.map((r) => ({ ...r, requestedAmount: Number(r.requestedAmount), approvedAmount: Number(r.approvedAmount), fundedAmount: Number(r.fundedAmount) }));
    }

    /** What the next period will need: approved vouchers waiting to go to Head Office or already with it, plus approved invoices not yet covered by a voucher. */
    static async suggest(userId: string, periodTo: Date) {
        const scope = await resolveOpmcScope(userId, 'finance');
        if (scope !== undefined) throw AppError.forbidden('Funding requests need company-wide finance access');
        const vouchers = await prisma.paymentVoucher.findMany({ where: { status: { in: ['APPROVED', 'SUBMITTED_TO_HO'] } }, select: { netAmount: true } });
        const invoices = await prisma.supplierInvoice.findMany({
            where: { status: { in: ['APPROVED', 'PARTIALLY_PAID'] }, OR: [{ dueDate: null }, { dueDate: { lte: periodTo } }] },
            select: { id: true, totalAmount: true, paidAmount: true },
        });
        const live = await prisma.paymentVoucher.groupBy({ by: ['supplierInvoiceId'], where: { supplierInvoiceId: { in: invoices.map((i) => i.id) }, status: { notIn: ['CANCELLED', 'REJECTED', 'PAID'] } }, _sum: { amount: true } });
        const covered = new Map(live.map((l) => [l.supplierInvoiceId, Number(l._sum.amount ?? 0)]));
        const uncovered = invoices.reduce((a, i) => a + Math.max(0, Number(i.totalAmount) - Number(i.paidAmount) - (covered.get(i.id) ?? 0)), 0);
        const voucherTotal = vouchers.reduce((a, v) => a + Number(v.netAmount), 0);
        return { vouchers: { count: vouchers.length, amount: round2(voucherTotal) }, invoices: { count: invoices.length, uncoveredAmount: round2(uncovered) }, total: round2(voucherTotal + uncovered) };
    }

    static async create(userId: string, input: { purpose: string; requestedAmount: number; periodFrom?: string | null; periodTo?: string | null; pettyCashAccountId?: string | null; remarks?: string | null; basis?: unknown }) {
        if (!(FUNDING_PURPOSES as readonly string[]).includes(input.purpose)) throw AppError.badRequest('INVALID_FUNDING_PURPOSE');
        if (!(input.requestedAmount > 0)) throw AppError.badRequest('REQUESTED_AMOUNT_REQUIRED');
        let account: { id: string; name: string; imprestLimit: unknown; currentBalance: unknown } | null = null;
        if (input.purpose !== 'PAYMENTS') {
            if (input.purpose === 'PETTY_CASH_REPLENISH') throw AppError.badRequest('REPLENISHMENT_COMES_FROM_A_PETTY_CASH_REIMBURSEMENT: request it from the petty cash page');
            if (!input.pettyCashAccountId) throw AppError.badRequest('PETTY_CASH_ACCOUNT_REQUIRED');
            account = await prisma.pettyCashAccount.findUnique({ where: { id: input.pettyCashAccountId }, select: { id: true, name: true, imprestLimit: true, currentBalance: true } });
            if (!account) throw AppError.badRequest('PETTY_CASH_ACCOUNT_NOT_FOUND');
            // the float may only fill what the imprest is short of: the limit less the cash in hand, the cash out on IOUs and the bills still to be reimbursed
            const { PettyCashService } = await import('@/services/finance/petty-cash.service');
            const box = (await PettyCashService.getSummaries(userId)).find((b) => b.id === account!.id);
            const room = box ? box.floatRoom : Number(account.imprestLimit) - Number(account.currentBalance);
            if (input.requestedAmount > room + 0.005) throw AppError.badRequest(`FLOAT_EXCEEDS_IMPREST_LIMIT: the float can only fill Rs. ${Math.max(0, room).toFixed(2)} (the imprest limit less cash in hand, cash on IOUs, bills waiting and floats already asked)`);
        }
        return prisma.$transaction(async (tx) => {
            const requestNumber = await AuditLedgerService.getNextDocumentNumber('HFR', tx);
            return tx.hoFundingRequest.create({
                data: {
                    requestNumber, purpose: input.purpose, status: 'DRAFT', requestedAmount: round2(input.requestedAmount),
                    periodFrom: input.periodFrom ? new Date(input.periodFrom) : null, periodTo: input.periodTo ? new Date(input.periodTo) : null,
                    pettyCashAccountId: account?.id ?? null, remarks: input.remarks ?? null, basis: (input.basis ?? undefined) as never, createdById: userId,
                },
            });
        });
    }

    private static async move(id: string, to: string, userId: string, data: Record<string, unknown>, audit: string) {
        const r = await prisma.hoFundingRequest.findUnique({ where: { id } });
        if (!r) throw AppError.notFound('Funding request not found');
        if (!canTransitionFunding(r.status, to)) throw AppError.badRequest(`INVALID_STATUS_TRANSITION: a ${r.status.toLowerCase()} request cannot become ${to.toLowerCase()}`);
        const claim = await prisma.hoFundingRequest.updateMany({ where: { id, status: r.status }, data: { status: to, ...data } });
        if (claim.count !== 1) throw AppError.conflict('This request was already actioned');
        AuditService.log({ userId, action: audit, entity: 'HO_FUNDING_REQUEST', entityId: id, oldValue: { status: r.status }, newValue: { status: to, ...data } }).catch(() => undefined);
        return r;
    }

    static async submit(id: string, userId: string) {
        await this.move(id, 'SUBMITTED', userId, { submittedAt: new Date() }, 'SUBMIT_HO_FUNDING');
        return prisma.hoFundingRequest.findUniqueOrThrow({ where: { id } });
    }

    static async cancel(id: string, userId: string) {
        await this.move(id, 'CANCELLED', userId, {}, 'CANCEL_HO_FUNDING');
        return prisma.hoFundingRequest.findUniqueOrThrow({ where: { id } });
    }

    static async approve(id: string, userId: string, approvedAmount: number) {
        const r = await prisma.hoFundingRequest.findUnique({ where: { id } });
        if (!r) throw AppError.notFound('Funding request not found');
        if (r.createdById && r.createdById === userId) throw AppError.badRequest('REQUESTER_CANNOT_APPROVE_OWN_FUNDING_REQUEST');
        if (!validApprovedAmount(r.purpose, Number(r.requestedAmount), approvedAmount)) throw AppError.badRequest('APPROVED_AMOUNT_INVALID: it must be above zero and not more than requested (a petty cash replenishment is approved in full)');
        await this.move(id, 'APPROVED', userId, { approvedAmount: round2(approvedAmount), approvedById: userId, approvedAt: new Date() }, 'APPROVE_HO_FUNDING');
        return prisma.hoFundingRequest.findUniqueOrThrow({ where: { id } });
    }

    static async reject(id: string, userId: string, reason: string) {
        if (!reason || reason.trim().length < 3) throw AppError.badRequest('REJECTION_REASON_REQUIRED');
        await this.move(id, 'REJECTED', userId, { rejectionReason: reason.trim() }, 'REJECT_HO_FUNDING');
        return prisma.hoFundingRequest.findUniqueOrThrow({ where: { id } });
    }

    /** Head Office provided the money. Petty cash funding tops up the imprest and posts to the Head Office current account. */
    static async fund(id: string, userId: string, input: { hoReference: string; fundedDate: string; fundedAmount?: number }) {
        if (!input.hoReference?.trim()) throw AppError.badRequest('HO_REFERENCE_REQUIRED');
        const date = new Date(input.fundedDate);
        if (Number.isNaN(date.getTime())) throw AppError.badRequest('FUNDED_DATE_INVALID');
        const r = await prisma.hoFundingRequest.findUnique({ where: { id } });
        if (!r) throw AppError.notFound('Funding request not found');
        if (r.createdById && r.createdById === userId) throw AppError.badRequest('REQUESTER_CANNOT_CONFIRM_THEIR_OWN_FUNDING');
        const amount = round2(input.fundedAmount ?? Number(r.approvedAmount));
        if (!validFundedAmount(Number(r.approvedAmount), amount)) throw AppError.badRequest('FUNDED_AMOUNT_INVALID: it cannot be more than approved');
        if (r.purpose === 'PETTY_CASH_REPLENISH' && Math.abs(amount - Number(r.approvedAmount)) > 0.005) throw AppError.badRequest('A petty cash replenishment is funded in full');

        return prisma.$transaction(async (tx) => {
            const claim = await tx.hoFundingRequest.updateMany({ where: { id, status: 'APPROVED' }, data: { status: 'FUNDED', fundedAmount: amount, hoReference: input.hoReference.trim(), fundedDate: date, fundedById: userId } });
            if (claim.count !== 1) throw AppError.conflict('This request was already actioned');
            let journalEntryId: string | null = null;
            if (r.pettyCashAccountId) journalEntryId = await this.topUpPettyCash(tx, r.id, r.requestNumber, r.pettyCashAccountId, r.reimbursementId, amount);
            if (journalEntryId) await tx.hoFundingRequest.update({ where: { id }, data: { journalEntryId } });
            AuditService.log({ userId, action: 'FUND_HO_FUNDING', entity: 'HO_FUNDING_REQUEST', entityId: id, newValue: { request: r.requestNumber, amount, hoReference: input.hoReference.trim() } }).catch(() => undefined);
            return tx.hoFundingRequest.findUniqueOrThrow({ where: { id } });
        });
    }

    private static async topUpPettyCash(tx: TransactionClient, fundingId: string, number: string, accountId: string, reimbursementId: string | null, amount: number): Promise<string | null> {
        const account = await tx.pettyCashAccount.findUnique({ where: { id: accountId } });
        if (!account) throw AppError.badRequest('PETTY_CASH_ACCOUNT_NOT_FOUND');
        const entry = await LedgerService.logHoPettyCashFunding(tx, fundingId, amount, `Head Office funding ${number} for ${account.name}`);
        const balance = Math.min(Number(account.imprestLimit), Number(account.currentBalance) + amount);
        await tx.pettyCashAccount.update({ where: { id: accountId }, data: { currentBalance: balance } });
        if (reimbursementId) {
            await tx.pettyCashReimbursement.update({ where: { id: reimbursementId }, data: { status: 'REIMBURSED' } });
            await tx.pettyCashVoucher.updateMany({ where: { reimbursementId }, data: { status: 'REIMBURSED' } });
        }
        return entry?.id ?? null;
    }

    /** Where OSP stands with Head Office: what was asked, approved and provided, and what Head Office has paid on OSP's behalf. */
    static async position(userId: string) {
        const scope = await resolveOpmcScope(userId, 'finance');
        if (scope !== undefined) throw AppError.forbidden('The Head Office position needs company-wide finance access');
        const [funding, submitted, paid, ho] = await Promise.all([
            prisma.hoFundingRequest.groupBy({ by: ['purpose'], where: { status: { in: ['SUBMITTED', 'APPROVED', 'FUNDED'] } }, _sum: { requestedAmount: true, approvedAmount: true, fundedAmount: true } }),
            prisma.paymentVoucher.aggregate({ where: { status: 'SUBMITTED_TO_HO' }, _sum: { netAmount: true }, _count: true }),
            prisma.paymentVoucher.aggregate({ where: { status: 'PAID', hoReference: { not: null } }, _sum: { netAmount: true }, _count: true }),
            prisma.journalLine.aggregate({ where: { accountCode: ACCOUNTS.HO_CURRENT }, _sum: { debit: true, credit: true } }),
        ]);
        const sum = (k: 'requestedAmount' | 'approvedAmount' | 'fundedAmount', purpose?: string) => funding.filter((f) => !purpose || f.purpose === purpose).reduce((a, f) => a + Number(f._sum[k] ?? 0), 0);
        const approvedPayments = sum('approvedAmount', 'PAYMENTS');
        const confirmedPaid = Number(paid._sum.netAmount ?? 0);
        return {
            requested: round2(sum('requestedAmount')), approved: round2(sum('approvedAmount')), funded: round2(sum('fundedAmount')),
            submittedUnpaid: { count: submitted._count, amount: round2(Number(submitted._sum.netAmount ?? 0)) },
            confirmedPaid: { count: paid._count, amount: round2(confirmedPaid) },
            paymentsAllocationLeft: remainingAllocation({ approved: approvedPayments, funded: 0, confirmedPaid }),
            dueToHeadOffice: round2(Number(ho._sum.credit ?? 0) - Number(ho._sum.debit ?? 0)),
        };
    }

    /** The current account with Head Office: every posting to HO-2020 with a running balance, for the monthly reconciliation. */
    static async account(userId: string, from?: string, to?: string) {
        const scope = await resolveOpmcScope(userId, 'finance');
        if (scope !== undefined) throw AppError.forbidden('The Head Office account needs company-wide finance access');
        const lines = await prisma.journalLine.findMany({
            where: { accountCode: ACCOUNTS.HO_CURRENT, entry: { ...(from || to ? { date: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}) } },
            orderBy: [{ entry: { date: 'asc' } }, { id: 'asc' }], take: 2000,
            select: { debit: true, credit: true, description: true, entry: { select: { id: true, date: true, referenceType: true, referenceId: true, description: true } } },
        });
        const refs = lines.filter((l) => l.entry.referenceType === 'PV_PAYMENT').map((l) => l.entry.referenceId).filter((x): x is string => !!x);
        const pvs = refs.length ? await prisma.paymentVoucher.findMany({ where: { id: { in: refs } }, select: { id: true, pvNumber: true, payeeName: true, hoReference: true } }) : [];
        const pvById = new Map(pvs.map((p) => [p.id, p]));
        // Collections made by Head Office on OSP's behalf (client invoices paid by SLT to Head Office)
        const rctIds = lines.filter((l) => l.entry.referenceType === 'CUSTOMER_RECEIPT').map((l) => l.entry.referenceId).filter((x): x is string => !!x);
        const rcts = rctIds.length ? await prisma.customerReceipt.findMany({ where: { id: { in: rctIds } }, select: { id: true, referenceNumber: true, invoice: { select: { invoiceNumber: true, project: { select: { name: true } } } } } }) : [];
        const rctById = new Map(rcts.map((r) => [r.id, r]));
        let balance = 0;
        const rows = lines.map((l) => {
            balance = round2(balance + Number(l.credit) - Number(l.debit));
            const pv = l.entry.referenceId ? pvById.get(l.entry.referenceId) : undefined;
            const rct = l.entry.referenceId ? rctById.get(l.entry.referenceId) : undefined;
            if (rct) {
                return { date: l.entry.date.toISOString().slice(0, 10), type: 'HO_COLLECTION', reference: rct.invoice?.invoiceNumber ?? l.entry.description ?? '', detail: `${rct.invoice?.project?.name ?? 'Client invoice'}${rct.referenceNumber ? ' · HO ref ' + rct.referenceNumber : ''}`, paidOnBehalf: Number(l.credit), returned: Number(l.debit), balance };
            }
            return { date: l.entry.date.toISOString().slice(0, 10), type: l.entry.referenceType ?? 'JOURNAL', reference: pv?.pvNumber ?? l.entry.description ?? '', detail: pv ? `${pv.payeeName}${pv.hoReference ? ' · HO ref ' + pv.hoReference : ''}` : (l.description ?? ''), paidOnBehalf: Number(l.credit), returned: Number(l.debit), balance };
        });
        return { balance, rows };
    }
}
