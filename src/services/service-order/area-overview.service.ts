import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { SOD_TURNAROUND_SLA_DAYS } from '@/lib/constants/sod-constants';
import { SODReturnClassifierService } from './sod-return-classifier.service';
import { resolveOpmcScope } from '@/lib/opmc-scope';

/** Statuses of an order that is still with the contractor (not finished, not returned). */
const IN_HAND = ['PENDING', 'ASSIGNED', 'INPROGRESS', 'PROV_CLOSED'] as const;
const FINISHED = ['COMPLETED', 'INSTALL_CLOSED'] as const;

/** The person's areas narrowed to one RTOM when it is one of theirs; any other RTOM name is ignored, so a filter can never widen what they see. */
export async function narrowScope(scope: string[], rtom?: string | null): Promise<string[]> {
    if (!rtom || rtom === 'ALL') return scope;
    const one = await prisma.oPMC.findFirst({ where: { rtom, id: { in: scope } }, select: { id: true } });
    return one ? [one.id] : scope;
}

const REASON_LABELS: Record<string, string> = {
    CUSTOMER_ABSENT: 'Customer absent / not ready', MATERIAL_SHORTAGE: 'Material shortage', PORT_SHORTAGE: 'Port shortage', INFRASTRUCTURE_ISSUE: 'Infrastructure issue', OTHER: 'Other', NO_REASON: 'No reason given',
};
const reasonOf = (text: string | null) => (text && text.trim() ? SODReturnClassifierService.classify(text).category : 'NO_REASON');

export interface AreaOverview {
    areas: Array<{ rtom: string; name: string }>;
    /** What the figures are for: the month, the RTOM chosen ('ALL' = every RTOM of the person). */
    month: string; monthNumber: number; year: number; rtom: string;
    totals: { inHand: number; completedThisMonth: number; returnedThisMonth: number };
    /** The month's returns of the area by the kind of reason (grouped from the free-text return reason), biggest first. */
    returnReasons: Array<{ category: string; label: string; count: number; pct: number }>;
    slaDays: number;
    contractors: Array<{ contractorId: string; name: string; inHand: number; oldestInHandDays: number | null; completedThisMonth: number; returnedThisMonth: number; slaPct: number | null; returnRatePct: number | null; topReturnReason: string | null }>;
}

/**
 * What the person's own RTOMs look like, for the dashboard of someone who works on service orders in an area: how many orders are with
 * contractors, how many each contractor has in hand and finished this month. Only reads; always limited to the person's areas.
 */
export class AreaOverviewService {
    static async forUser(userId: string, opts: { month?: number; year?: number; rtom?: string } = {}): Promise<AreaOverview | null> {
        const allScope = await resolveOpmcScope(userId);
        // A person with no area limit (company-wide) has no "own area": the company dashboards are for them.
        if (allScope === undefined) return null;
        const now = new Date();
        const m = opts.month && opts.month >= 1 && opts.month <= 12 ? opts.month : now.getMonth() + 1;
        const y = opts.year && opts.year >= 2020 && opts.year <= 2100 ? opts.year : now.getFullYear();
        const from = new Date(y, m - 1, 1);
        const to = new Date(y, m, 1);
        const month = from.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
        const scope = await narrowScope(allScope, opts.rtom);
        const which = { monthNumber: m, year: y, rtom: scope.length === 1 && allScope.length > 1 ? (opts.rtom ?? 'ALL') : 'ALL' };
        if (scope.length === 0) return { areas: [], month, ...which, totals: { inHand: 0, completedThisMonth: 0, returnedThisMonth: 0 }, returnReasons: [], slaDays: SOD_TURNAROUND_SLA_DAYS, contractors: [] };
        // Every service order has a contractor, so the figures are the contractors' own: an order with none is a data gap, not something to work from here.
        const area = { opmcId: { in: scope }, contractorId: { not: null } };
        const [areas, open, done, returnedRaw, slaRows] = await Promise.all([
            prisma.oPMC.findMany({ where: { id: { in: allScope } }, select: { rtom: true, name: true }, orderBy: { rtom: 'asc' } }),
            prisma.serviceOrder.groupBy({ by: ['contractorId'], where: { ...area, sltsStatus: { in: [...IN_HAND] }, status: { notIn: ['COMPLETED', 'INSTALL_CLOSED', 'RETURN', 'DISAPPEARED'] } }, _count: { _all: true }, _min: { receivedDate: true } }),
            prisma.serviceOrder.groupBy({ by: ['contractorId'], where: { ...area, sltsStatus: { in: [...FINISHED] }, completedDate: { gte: from, lt: to } }, _count: { _all: true } }),
            prisma.serviceOrder.groupBy({ by: ['contractorId', 'returnReason'], where: { ...area, sltsStatus: 'RETURN', completedDate: { gte: from, lt: to } }, _count: { _all: true } }),
            // Orders completed in the month within the target days of being received, per contractor (orders with a missing or impossible date are left out).
            prisma.$queryRaw<Array<{ cid: string; total: number; within: number }>>(Prisma.sql`
                select s."contractorId"::text as cid, count(*)::int as total,
                       count(*) filter (where s."completedDate" - s."receivedDate" <= make_interval(days => ${SOD_TURNAROUND_SLA_DAYS}::int))::int as within
                from "ServiceOrder" s
                where s."contractorId" is not null and s."opmcId" = any(${scope}::uuid[])
                  and s."sltsStatus"::text = any(${[...FINISHED]}::text[])
                  and s."completedDate" >= ${from} and s."completedDate" < ${to}
                  and s."receivedDate" is not null and s."completedDate" >= s."receivedDate"
                group by 1`),
        ]);
        // The returns, by contractor and by kind of reason (each distinct text is classified once per row).
        const returned = returnedRaw;
        const ids = [...new Set([...open, ...done, ...returned].map((r) => r.contractorId).filter((c): c is string => !!c))];
        const names = new Map((await prisma.contractor.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })).map((c) => [c.id, c.name]));
        const rows = new Map<string, AreaOverview['contractors'][number]>();
        const row = (id: string | null) => {
            const key = id as string;
            if (!rows.has(key)) rows.set(key, { contractorId: key, name: names.get(key) ?? 'Contractor', inHand: 0, oldestInHandDays: null, completedThisMonth: 0, returnedThisMonth: 0, slaPct: null, returnRatePct: null, topReturnReason: null });
            return rows.get(key)!;
        };
        for (const r of open) {
            const x = row(r.contractorId);
            x.inHand = r._count._all;
            x.oldestInHandDays = r._min.receivedDate ? Math.max(0, Math.floor((now.getTime() - r._min.receivedDate.getTime()) / 86_400_000)) : null;
        }
        for (const r of done) row(r.contractorId).completedThisMonth = r._count._all;
        const reasonByContractor = new Map<string, Map<string, number>>();
        const reasonTotals = new Map<string, number>();
        for (const r of returned) {
            row(r.contractorId).returnedThisMonth += r._count._all;
            const cat = reasonOf(r.returnReason);
            reasonTotals.set(cat, (reasonTotals.get(cat) ?? 0) + r._count._all);
            const m = reasonByContractor.get(r.contractorId as string) ?? new Map<string, number>();
            m.set(cat, (m.get(cat) ?? 0) + r._count._all);
            reasonByContractor.set(r.contractorId as string, m);
        }
        const sla = new Map(slaRows.map((r) => [r.cid, r]));
        for (const c of rows.values()) {
            const x = sla.get(c.contractorId);
            c.slaPct = x && Number(x.total) > 0 ? Number(((Number(x.within) / Number(x.total)) * 100).toFixed(1)) : null;
            const all = c.completedThisMonth + c.returnedThisMonth;
            c.returnRatePct = all > 0 ? Number(((c.returnedThisMonth / all) * 100).toFixed(1)) : null;
            const top = [...(reasonByContractor.get(c.contractorId)?.entries() ?? [])].sort((a, b) => b[1] - a[1])[0];
            c.topReturnReason = top ? REASON_LABELS[top[0]] ?? top[0] : null;
        }
        const returnedTotal = [...reasonTotals.values()].reduce((a, n) => a + n, 0);
        const returnReasons = [...reasonTotals.entries()].map(([category, count]) => ({ category, label: REASON_LABELS[category] ?? category, count, pct: returnedTotal > 0 ? Number(((count / returnedTotal) * 100).toFixed(1)) : 0 })).sort((a, b) => b.count - a.count);
        const contractors = [...rows.values()].sort((a, b) => b.inHand - a.inHand || b.completedThisMonth - a.completedThisMonth || a.name.localeCompare(b.name));
        const sum = (f: (c: AreaOverview['contractors'][number]) => number) => contractors.reduce((a, c) => a + f(c), 0);
        return {
            areas, month, ...which, contractors, returnReasons, slaDays: SOD_TURNAROUND_SLA_DAYS,
            totals: {
                inHand: sum((c) => c.inHand),
                completedThisMonth: sum((c) => c.completedThisMonth),
                returnedThisMonth: sum((c) => c.returnedThisMonth),
            },
        };
    }
}
