import { prisma } from '@/lib/prisma';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { narrowScope } from '@/services/service-order/area-overview.service';

const DAY = 86_400_000;
const STUCK_DAYS = 3;
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const daysSince = (d: Date | null | undefined) => (d ? Math.max(0, Math.floor((Date.now() - d.getTime()) / DAY)) : null);

export interface DeskInvoice { id: string; invoiceNumber: string; contractor: string; area: string; orders: number; total: number; waitingDays: number | null }
export interface AreaManagerDesk {
    month: string; monthNumber: number; year: number; rtom: string;
    /** invoices waiting at the Area Manager step of the person's own areas */
    invoices: { count: number; total: number; oldestDays: number | null; list: DeskInvoice[] };
    /** every invoice of the areas still in approval, by who it waits for, and how many have waited more than the allowed days */
    inApproval: Array<{ stage: string; count: number; stuck: number }>;
    stuckDays: number;
    contractorRegistrations: { count: number; list: Array<{ id: string; name: string; area: string; waitingDays: number | null }> };
    /** the billing month of the areas: what was invoiced, what the contractors earn and what it brings in */
    month_figures: { invoices: number; orders: number; contractorAmount: number; revenueAmount: number; marginPct: number | null; approvedByArea: number; approvedAmount: number };
}

/**
 * The Area Manager's desk: what waits for their decision (invoices at their step, contractors waiting for their approval), where invoices
 * are stuck in the areas they manage, and the money of the billing month. Only reads; always limited to the person's own areas.
 */
export class AreaManagerDeskService {
    static async forUser(userId: string, opts: { month?: number; year?: number; rtom?: string } = {}): Promise<AreaManagerDesk | null> {
        const allScope = await resolveOpmcScope(userId, 'sod');
        if (allScope === undefined) return null;
        const now = new Date();
        const m = opts.month && opts.month >= 1 && opts.month <= 12 ? opts.month : now.getMonth() + 1;
        const y = opts.year && opts.year >= 2020 && opts.year <= 2100 ? opts.year : now.getFullYear();
        const month = new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
        const scope = await narrowScope(allScope, opts.rtom);
        const which = { month, monthNumber: m, year: y, rtom: scope.length === 1 && allScope.length > 1 ? (opts.rtom ?? 'ALL') : 'ALL' };
        const emptyFig = { invoices: 0, orders: 0, contractorAmount: 0, revenueAmount: 0, marginPct: null, approvedByArea: 0, approvedAmount: 0 };
        if (scope.length === 0) return { ...which, invoices: { count: 0, total: 0, oldestDays: null, list: [] }, inApproval: [], stuckDays: STUCK_DAYS, contractorRegistrations: { count: 0, list: [] }, month_figures: emptyFig };

        const inScope = { opmcId: { in: scope } };
        const open = { ...inScope, status: { not: 'CANCELLED' as const }, confirmStage: { notIn: ['CONFIRMED', 'CANCELLED'] } };
        const [mine, openAll, contractors, monthInv, orderSums] = await Promise.all([
            prisma.invoice.findMany({
                where: { ...open, confirmStage: 'AREA_MANAGER' }, orderBy: { createdAt: 'asc' }, take: 200,
                select: { id: true, invoiceNumber: true, totalAmount: true, createdAt: true, contractor: { select: { name: true } }, opmc: { select: { rtom: true } }, _count: { select: { sods: true } } },
            }),
            prisma.invoice.findMany({ where: open, select: { confirmStage: true, createdAt: true } }),
            prisma.contractor.findMany({ where: { status: 'ARM_PENDING', opmcId: { in: scope } }, orderBy: { createdAt: 'asc' }, take: 50, select: { id: true, name: true, createdAt: true, opmc: { select: { rtom: true } } } }),
            prisma.invoice.findMany({ where: { ...inScope, month: m, year: y, status: { not: 'CANCELLED' } }, select: { confirmStage: true, totalAmount: true } }),
            prisma.serviceOrder.aggregate({ where: { opmcId: { in: scope }, invoiced: true, invoice: { is: { month: m, year: y, status: { not: 'CANCELLED' } } } }, _sum: { contractorAmount: true, revenueAmount: true }, _count: { _all: true } }),
        ]);

        const byStage = new Map<string, { count: number; stuck: number }>();
        for (const i of openAll) {
            const s = byStage.get(i.confirmStage) ?? { count: 0, stuck: 0 };
            s.count += 1; if ((daysSince(i.createdAt) ?? 0) > STUCK_DAYS) s.stuck += 1;
            byStage.set(i.confirmStage, s);
        }
        const revenue = num(orderSums._sum.revenueAmount), cost = num(orderSums._sum.contractorAmount);
        const approved = monthInv.filter((i) => i.confirmStage === 'CONFIRMED');
        return {
            ...which,
            invoices: {
                count: mine.length, total: mine.reduce((a, i) => a + num(i.totalAmount), 0), oldestDays: mine.length ? daysSince(mine[0].createdAt) : null,
                list: mine.slice(0, 8).map((i) => ({ id: i.id, invoiceNumber: i.invoiceNumber, contractor: i.contractor?.name ?? '-', area: i.opmc?.rtom ?? '-', orders: i._count.sods, total: num(i.totalAmount), waitingDays: daysSince(i.createdAt) })),
            },
            inApproval: [...byStage.entries()].map(([stage, v]) => ({ stage, ...v })).sort((a, b) => b.count - a.count),
            stuckDays: STUCK_DAYS,
            contractorRegistrations: { count: contractors.length, list: contractors.slice(0, 8).map((c) => ({ id: c.id, name: c.name, area: c.opmc?.rtom ?? '-', waitingDays: daysSince(c.createdAt) })) },
            month_figures: {
                invoices: monthInv.length, orders: orderSums._count._all, contractorAmount: cost, revenueAmount: revenue,
                marginPct: revenue > 0 ? Math.round(((revenue - cost) / revenue) * 1000) / 10 : null,
                approvedByArea: approved.length, approvedAmount: approved.reduce((a, i) => a + num(i.totalAmount), 0),
            },
        };
    }
}
