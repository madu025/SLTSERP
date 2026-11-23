import { prisma } from '@/lib/prisma';
import { isValidUuid } from '@/lib/uuid';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { narrowScope } from '@/services/service-order/area-overview.service';
import { SOD_INVOICE_REF } from '@/lib/payment-voucher-access';
import { trackInvoice, type InvoiceTrack, type TrackerVoucher } from '@/lib/invoice-tracker';

const FETCH = 400;
const SHOW = 150;
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const DAY = 86_400_000;

export interface InvoiceStatusRow {
    id: string; invoiceNumber: string; contractor: string; contractorId: string; rtom: string; month: number | null; year: number | null;
    orders: number; total: number; retention: number; createdAt: string; daysOpen: number;
    track: InvoiceTrack;
    /** the service order the person searched for, when it is on this invoice */
    matchedOrder: string | null;
    /** payment reference of Head Office, once paid */
    hoReference: string | null;
}
export interface InvoiceStatusResult {
    areas: Array<{ rtom: string; name: string }>; rtom: string;
    rows: InvoiceStatusRow[];
    summary: { total: number; paid: number; cancelled: number; open: number; byStep: Array<{ key: string; label: string; count: number }> };
    /** every contractor of the person's RTOMs that has invoices, for the filter (all-island there are hundreds) */
    contractors: Array<{ id: string; name: string; count: number }>;
    /** the unpaid invoices of each contractor in this answer: how many, how much, how long the oldest has waited */
    byContractor: Array<{ id: string; name: string; open: number; openAmount: number; oldestDays: number }>;
    /** the answer holds more invoices than are shown */
    truncated: boolean;
}

/** Plain names of the steps an invoice can wait at, for the summary. */
const STEP_LABEL: Record<string, string> = {
    CONTRACTOR: 'Contractor', AREA: 'Area Manager', SF_AUDIT: 'OSP Quality (SF Audit)', OSP_SEND: 'Finance: send to OSP managers', OSP_APPROVE: 'OSP Manager',
    PAYMENT_REQUEST: 'Finance: prepare payment', HO_PAYMENT: 'Head Office payment', FINANCE_APPROVAL: 'Finance approval',
};

/**
 * Where the contractor invoices of the person's own RTOMs are on their way to payment. Any service order person (Area Coordinator, QC
 * Officer, Engineer, Area Manager) can answer a contractor who asks "where is my invoice, is my payment near". Only reads; always limited
 * to the person's own areas.
 */
export class InvoiceStatusService {
    static async forUser(userId: string, opts: { rtom?: string; search?: string; state?: string; contractorId?: string; month?: number; year?: number; minDays?: number; sort?: string } = {}): Promise<InvoiceStatusResult> {
        const allScope = await resolveOpmcScope(userId, 'finance');
        const areaWhere = allScope === undefined ? {} : { id: { in: allScope } };
        const areas = await prisma.oPMC.findMany({ where: areaWhere, select: { id: true, rtom: true, name: true }, orderBy: { rtom: 'asc' } });
        const empty: InvoiceStatusResult = { areas: areas.map((a) => ({ rtom: a.rtom, name: a.name })), rtom: 'ALL', rows: [], summary: { total: 0, paid: 0, cancelled: 0, open: 0, byStep: [] }, contractors: [], byContractor: [], truncated: false };
        if (allScope !== undefined && allScope.length === 0) return empty;
        const scope = await narrowScope(areas.map((a) => a.id), opts.rtom);
        const rtom = scope.length === 1 && areas.length > 1 ? (areas.find((a) => a.id === scope[0])?.rtom ?? 'ALL') : 'ALL';
        const q = (opts.search ?? '').trim();

        const inScope = { OR: [{ opmcId: { in: scope } }, { opmcId: null, contractor: { opmcId: { in: scope } } }] };
        const sort = opts.sort ?? 'newest';
        // the filter list: every contractor of the areas that has an invoice
        const grouped = await prisma.invoice.groupBy({ by: ['contractorId'], where: inScope, _count: { _all: true } });
        const names = grouped.length ? await prisma.contractor.findMany({ where: { id: { in: grouped.map((g) => g.contractorId) } }, select: { id: true, name: true } }) : [];
        const nameOf = new Map(names.map((c) => [c.id, c.name]));
        const contractors = grouped.map((g) => ({ id: g.contractorId, name: nameOf.get(g.contractorId) ?? '-', count: g._count._all })).sort((a, b) => a.name.localeCompare(b.name));

        const invoices = await prisma.invoice.findMany({
            where: {
                ...inScope,
                ...(opts.contractorId && isValidUuid(opts.contractorId) ? { contractorId: opts.contractorId } : {}),
                ...(opts.month && opts.month >= 1 && opts.month <= 12 ? { month: opts.month } : {}),
                ...(opts.year ? { year: opts.year } : {}),
                ...(q ? { AND: [{ OR: [{ invoiceNumber: { contains: q, mode: 'insensitive' } }, { contractor: { name: { contains: q, mode: 'insensitive' } } }, { sods: { some: { soNum: { contains: q, mode: 'insensitive' } } } }] }] } : {}),
            },
            orderBy: { createdAt: sort === 'oldest' || sort === 'days' ? 'asc' : 'desc' }, take: FETCH,
            select: {
                id: true, invoiceNumber: true, month: true, year: true, totalAmount: true, amount: true, retentionAmount: true, status: true, statusA: true, statusB: true, approvalStatus: true, approvalFlow: true,
                confirmStage: true, contractorConfirmStatus: true, contractorConfirmedAt: true, contractorNote: true, createdAt: true, ospSentAt: true, ospDecisionAt: true, ospNote: true, paidDateA: true,
                contractorId: true, contractor: { select: { name: true } }, opmc: { select: { rtom: true } }, rtomArea: true,
                _count: { select: { sods: true } },
                sods: q ? { where: { soNum: { contains: q, mode: 'insensitive' } }, select: { soNum: true }, take: 1 } : false,
            },
        });
        const ids = invoices.map((i) => i.id);
        const vouchers = ids.length ? await prisma.paymentVoucher.findMany({
            where: { OR: ids.map((id) => ({ description: { startsWith: `${SOD_INVOICE_REF}${id}` } })), status: { not: 'CANCELLED' } },
            select: { description: true, status: true, createdAt: true, submittedToHoAt: true, hoPaidDate: true, hoReference: true },
        }) : [];
        // when the area approval finished (the last approved step of the invoice gate)
        const approvals = ids.length ? await prisma.universalApprovalInstance.findMany({ where: { entityType: 'INVOICE', entityId: { in: ids }, status: 'APPROVED', requiredRole: { not: 'CONTRACTOR' } }, select: { entityId: true, actionedAt: true } }) : [];
        const areaAt = new Map<string, Date>();
        for (const a of approvals) if (a.actionedAt && (!areaAt.get(a.entityId) || a.actionedAt > (areaAt.get(a.entityId) as Date))) areaAt.set(a.entityId, a.actionedAt);
        const voucherOf = (id: string): { v: TrackerVoucher; ref: string | null } => {
            const mine = vouchers.filter((v) => (v.description ?? '').startsWith(`${SOD_INVOICE_REF}${id}`));
            if (mine.length === 0) return { v: { exists: false }, ref: null };
            const paid = mine.every((v) => v.status === 'PAID');
            const submitted = mine.map((v) => v.submittedToHoAt).filter(Boolean).sort()[0] ?? null;
            const hoPaid = mine.map((v) => v.hoPaidDate).filter(Boolean).sort().slice(-1)[0] ?? null;
            return { v: { exists: true, createdAt: mine.map((v) => v.createdAt).sort()[0], submittedToHoAt: submitted, paid, hoPaidDate: hoPaid, hoReference: mine.find((v) => v.hoReference)?.hoReference ?? null }, ref: mine.find((v) => v.hoReference)?.hoReference ?? null };
        };

        let rows: InvoiceStatusRow[] = invoices.map((i) => {
            const { v, ref } = voucherOf(i.id);
            const track = trackInvoice({ ...i, areaApprovedAt: areaAt.get(i.id) ?? null }, v);
            const sods = (i as unknown as { sods?: Array<{ soNum: string }> }).sods;
            return {
                id: i.id, invoiceNumber: i.invoiceNumber, contractor: i.contractor?.name ?? '-', contractorId: i.contractorId, rtom: i.opmc?.rtom ?? i.rtomArea ?? '-', month: i.month, year: i.year,
                orders: i._count.sods, total: num(i.totalAmount) || num(i.amount), retention: num(i.retentionAmount), createdAt: i.createdAt.toISOString(),
                daysOpen: Math.max(0, Math.floor((Date.now() - i.createdAt.getTime()) / DAY)), track,
                matchedOrder: q && Array.isArray(sods) && sods[0] ? sods[0].soNum : null, hoReference: ref,
            };
        });
        const byStep = new Map<string, number>();
        for (const r of rows) if (!r.track.finished && !r.track.cancelled && r.track.currentKey) byStep.set(r.track.currentKey, (byStep.get(r.track.currentKey) ?? 0) + 1);
        const summary = {
            total: rows.length, paid: rows.filter((r) => r.track.finished).length, cancelled: rows.filter((r) => r.track.cancelled).length,
            open: rows.filter((r) => !r.track.finished && !r.track.cancelled).length,
            byStep: [...byStep.entries()].map(([key, count]) => ({ key, label: STEP_LABEL[key] ?? key, count })).sort((a, b) => b.count - a.count),
        };
        const state = opts.state ?? 'all';
        // the unpaid invoices of each contractor in this answer
        const per = new Map<string, { id: string; name: string; open: number; openAmount: number; oldestDays: number }>();
        for (const r of rows) {
            if (r.track.finished || r.track.cancelled) continue;
            const e = per.get(r.contractorId) ?? { id: r.contractorId, name: r.contractor, open: 0, openAmount: 0, oldestDays: 0 };
            e.open += 1; e.openAmount += r.total; e.oldestDays = Math.max(e.oldestDays, r.daysOpen); per.set(r.contractorId, e);
        }
        const byContractor = [...per.values()].sort((a, b) => b.oldestDays - a.oldestDays).slice(0, 60);
        if (state === 'open') rows = rows.filter((r) => !r.track.finished && !r.track.cancelled);
        else if (state === 'paid') rows = rows.filter((r) => r.track.finished);
        else if (state !== 'all' && STEP_LABEL[state]) rows = rows.filter((r) => r.track.currentKey === state && !r.track.cancelled);
        if (opts.minDays && opts.minDays > 0) rows = rows.filter((r) => !r.track.finished && !r.track.cancelled && r.daysOpen >= (opts.minDays as number));
        if (sort === 'amount') rows.sort((a, b) => b.total - a.total);
        else if (sort === 'days') rows.sort((a, b) => Number(a.track.finished || a.track.cancelled) - Number(b.track.finished || b.track.cancelled) || b.daysOpen - a.daysOpen);
        return { areas: empty.areas, rtom, rows: rows.slice(0, SHOW), summary, contractors, byContractor, truncated: rows.length > SHOW || invoices.length >= FETCH };
    }
}
