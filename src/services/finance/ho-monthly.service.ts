import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { AuditService } from '@/services/audit/audit.service';
import { ACCOUNTS } from '@/services/finance/account-codes';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { categoryOfSupplierInvoice, defaultWhtFor, type PaymentCategory } from '@/config/payment-categories';
import { currentMonth, monthRange, planState, reconciliationBlocker, reconciliationDifference, reconciliationStatus, unrequestedAmount, type PlanState } from '@/lib/ho-monthly-rules';

const num = (v: unknown) => Number(v ?? 0);
const round2 = (n: number) => Math.round(n * 100) / 100;
const LIVE = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SUBMITTED_TO_HO'];

export interface PlanRow {
    kind: 'VENDOR' | 'CONTRACTOR' | 'SOD'; category: PaymentCategory; payeeId: string | null; blocked: string | null; whtDefault: number; id: string; number: string; payee: string; project: string | null; projectId: string | null;
    dueDate: string | null; overdue: boolean; outstanding: number; requested: number; withHeadOffice: number; unrequested: number; state: PlanState;
}

/** What has to be paid to vendors and contractors up to the end of a month, and where each payment stands with Head Office. */
export class HoMonthlyService {
    static async plan(userId: string, month?: string) {
        const m = month || currentMonth();
        const range = monthRange(m);
        if (!range) throw AppError.badRequest('INVALID_MONTH: use YYYY-MM');
        const scope = await resolveOpmcScope(userId);
        const rows: PlanRow[] = [];

        if (scope === undefined) {
            const invoices = await prisma.supplierInvoice.findMany({
                where: { status: { in: ['APPROVED', 'PARTIALLY_PAID'] }, OR: [{ dueDate: null }, { dueDate: { lte: range.end } }] },
                orderBy: { dueDate: 'asc' }, take: 500,
                select: { id: true, invoiceNumber: true, totalAmount: true, paidAmount: true, dueDate: true, category: true, vendorId: true, vendor: { select: { name: true } } },
            });
            const live = await prisma.paymentVoucher.groupBy({ by: ['supplierInvoiceId', 'status'], where: { supplierInvoiceId: { in: invoices.map((i) => i.id) }, status: { in: LIVE } }, _sum: { amount: true } });
            for (const i of invoices) {
                const mine = live.filter((l) => l.supplierInvoiceId === i.id);
                const requested = round2(mine.reduce((a, l) => a + num(l._sum.amount), 0));
                const withHo = round2(mine.filter((l) => l.status === 'SUBMITTED_TO_HO').reduce((a, l) => a + num(l._sum.amount), 0));
                const outstanding = round2(num(i.totalAmount) - num(i.paidAmount));
                if (outstanding <= 0) continue;
                rows.push({ kind: 'VENDOR', category: categoryOfSupplierInvoice(i.category), payeeId: i.vendorId, blocked: null, whtDefault: defaultWhtFor(categoryOfSupplierInvoice(i.category), outstanding), id: i.id, number: i.invoiceNumber, payee: i.vendor.name, project: null, projectId: null, dueDate: i.dueDate ? i.dueDate.toISOString().slice(0, 10) : null, overdue: !!i.dueDate && i.dueDate < range.start, outstanding, requested, withHeadOffice: withHo, unrequested: unrequestedAmount(outstanding, requested), state: planState(outstanding, requested, withHo) });
            }
        }

        const cinv = await prisma.projectInvoice.findMany({
            where: { type: 'CONTRACTOR', status: { in: ['ISSUED', 'PARTIALLY_PAID', 'FOLLOW_UP'] }, balanceAmount: { gt: 0 }, OR: [{ dueDate: null }, { dueDate: { lte: range.end } }], ...(scope === undefined ? {} : { project: { opmcId: { in: scope } } }) },
            orderBy: { dueDate: 'asc' }, take: 500,
            select: { id: true, invoiceNumber: true, balanceAmount: true, dueDate: true, projectId: true, contractorId: true, project: { select: { name: true } }, contractor: { select: { name: true } } },
        });
        const clive = await prisma.paymentVoucher.groupBy({ by: ['invoiceId', 'status'], where: { invoiceId: { in: cinv.map((i) => i.id) }, status: { in: LIVE } }, _sum: { amount: true } });
        for (const i of cinv) {
            const mine = clive.filter((l) => l.invoiceId === i.id);
            const requested = round2(mine.reduce((a, l) => a + num(l._sum.amount), 0));
            const withHo = round2(mine.filter((l) => l.status === 'SUBMITTED_TO_HO').reduce((a, l) => a + num(l._sum.amount), 0));
            const outstanding = round2(num(i.balanceAmount));
            rows.push({ kind: 'CONTRACTOR', category: 'PROJECT_CONTRACTOR', payeeId: i.contractorId, blocked: null, whtDefault: 0, id: i.id, number: i.invoiceNumber, payee: i.contractor?.name ?? 'Contractor', project: i.project?.name ?? null, projectId: i.projectId, dueDate: i.dueDate ? i.dueDate.toISOString().slice(0, 10) : null, overdue: !!i.dueDate && i.dueDate < range.start, outstanding, requested, withHeadOffice: withHo, unrequested: unrequestedAmount(outstanding, requested), state: planState(outstanding, requested, withHo) });
        }

        // SOD contractors: the monthly contractor invoices (legacy Invoice model) that have been approved and are not fully paid
        const sodInvoices = await prisma.invoice.findMany({
            where: { approvalStatus: 'APPROVED', status: { not: 'PAID' }, AND: [{ OR: [{ dueDate: null }, { dueDate: { lte: range.end } }] }, ...(scope === undefined ? [] : [{ OR: [{ project: { opmcId: { in: scope } } }, { projectId: null, contractor: { opmcId: { in: scope } } }] }])] },
            orderBy: { dueDate: 'asc' }, take: 500,
            select: { id: true, invoiceNumber: true, amount: true, dueDate: true, projectId: true, contractorId: true, project: { select: { name: true } }, contractor: { select: { name: true } } },
        });
        if (sodInvoices.length > 0) {
            const bom = await prisma.paymentVoucher.findMany({
                where: { OR: sodInvoices.map((i) => ({ description: { startsWith: `BOM_INVOICING_REF:${i.id}` } })), status: { in: [...LIVE, 'PAID'] } },
                select: { description: true, status: true, amount: true },
            });
            for (const i of sodInvoices) {
                const mine = bom.filter((v) => (v.description ?? '').startsWith(`BOM_INVOICING_REF:${i.id}`));
                const paid = round2(mine.filter((v) => v.status === 'PAID').reduce((a, v) => a + num(v.amount), 0));
                const liveAmt = round2(mine.filter((v) => v.status !== 'PAID').reduce((a, v) => a + num(v.amount), 0));
                const withHo = round2(mine.filter((v) => v.status === 'SUBMITTED_TO_HO').reduce((a, v) => a + num(v.amount), 0));
                const outstanding = round2(num(i.amount) - paid);
                if (outstanding <= 0) continue;
                rows.push({ kind: 'SOD', category: 'SOD_CONTRACTOR', payeeId: i.contractorId, blocked: null, whtDefault: 0, id: i.id, number: i.invoiceNumber, payee: i.contractor?.name ?? 'Contractor', project: i.project?.name ?? null, projectId: i.projectId, dueDate: i.dueDate ? i.dueDate.toISOString().slice(0, 10) : null, overdue: !!i.dueDate && i.dueDate < range.start, outstanding, requested: liveAmt, withHeadOffice: withHo, unrequested: unrequestedAmount(outstanding, liveAmt), state: planState(outstanding, liveAmt, withHo) });
            }
        }

        const paidThisMonth = await prisma.paymentVoucher.aggregate({ where: { status: 'PAID', hoPaidDate: { gte: range.start, lte: range.end } }, _sum: { netAmount: true } });
        const funding = scope === undefined
            ? await prisma.hoFundingRequest.aggregate({ where: { purpose: 'PAYMENTS', status: { in: ['SUBMITTED', 'APPROVED', 'FUNDED'] }, periodTo: { gte: range.start, lte: range.end } }, _sum: { requestedAmount: true, approvedAmount: true, fundedAmount: true } })
            : null;
        const sum = (f: (r: PlanRow) => number) => round2(rows.reduce((a, r) => a + f(r), 0));
        return {
            month: m,
            rows: rows.sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999')),
            totals: { due: sum((r) => r.outstanding), requested: sum((r) => r.requested), withHeadOffice: sum((r) => r.withHeadOffice), unrequested: sum((r) => r.unrequested), overdue: sum((r) => (r.overdue ? r.outstanding : 0)), paidByHeadOfficeThisMonth: round2(num(paidThisMonth._sum.netAmount)) },
            funding: funding ? { requested: num(funding._sum.requestedAmount), approved: num(funding._sum.approvedAmount), funded: num(funding._sum.fundedAmount) } : null,
        };
    }

    // ---- month-end reconciliation of the Head Office account ----
    static async reconciliations(userId: string) {
        const scope = await resolveOpmcScope(userId);
        if (scope !== undefined) throw AppError.forbidden('The Head Office account needs company-wide finance access');
        const rows = await prisma.hoReconciliation.findMany({ orderBy: { month: 'desc' }, take: 36 });
        return rows.map((r) => ({ ...r, ledgerBalance: num(r.ledgerBalance), hoBalance: num(r.hoBalance), difference: num(r.difference) }));
    }

    /** The ledger's Head Office balance (credit less debit) up to the end of the month. */
    static async ledgerBalanceAt(month: string): Promise<number> {
        const range = monthRange(month);
        if (!range) throw AppError.badRequest('INVALID_MONTH: use YYYY-MM');
        const agg = await prisma.journalLine.aggregate({ where: { accountCode: ACCOUNTS.HO_CURRENT, entry: { date: { lte: range.end } } }, _sum: { debit: true, credit: true } });
        return round2(num(agg._sum.credit) - num(agg._sum.debit));
    }

    static async record(userId: string, input: { month: string; hoBalance: number; note?: string | null }) {
        const scope = await resolveOpmcScope(userId);
        if (scope !== undefined) throw AppError.forbidden('The Head Office account needs company-wide finance access');
        const range = monthRange(input.month);
        if (!range) throw AppError.badRequest('INVALID_MONTH: use YYYY-MM');
        if (range.start > new Date()) throw AppError.badRequest('A month that has not started cannot be reconciled');
        if (!Number.isFinite(input.hoBalance)) throw AppError.badRequest('HO_BALANCE_REQUIRED');
        const ledger = await this.ledgerBalanceAt(input.month);
        const diff = reconciliationDifference(ledger, input.hoBalance);
        const existing = await prisma.hoReconciliation.findUnique({ where: { month: input.month }, select: { status: true } });
        const blocker = reconciliationBlocker(existing?.status ?? null, diff, input.note);
        if (blocker) throw AppError.badRequest(blocker);
        const data = { ledgerBalance: ledger, hoBalance: round2(input.hoBalance), difference: diff, status: reconciliationStatus(diff), note: input.note?.trim() || null, recordedById: userId, recordedAt: new Date() };
        const row = await prisma.hoReconciliation.upsert({ where: { month: input.month }, create: { month: input.month, ...data }, update: data });
        AuditService.log({ userId, action: 'HO_RECONCILE', entity: 'HO_RECONCILIATION', entityId: row.id, newValue: { month: input.month, ledger, hoBalance: input.hoBalance, difference: diff, status: row.status } }).catch(() => undefined);
        return { ...row, ledgerBalance: num(row.ledgerBalance), hoBalance: num(row.hoBalance), difference: num(row.difference) };
    }
}
