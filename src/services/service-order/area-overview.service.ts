import { prisma } from '@/lib/prisma';
import { resolveOpmcScope } from '@/lib/opmc-scope';

/** Statuses of an order that is still with the contractor (not finished, not returned). */
const IN_HAND = ['PENDING', 'ASSIGNED', 'INPROGRESS', 'PROV_CLOSED'] as const;
const FINISHED = ['COMPLETED', 'INSTALL_CLOSED'] as const;

export interface AreaOverview {
    areas: Array<{ rtom: string; name: string }>;
    month: string;
    totals: { notAssigned: number; inHand: number; completedThisMonth: number; returnedThisMonth: number; finishedNoContractor: number };
    contractors: Array<{ contractorId: string | null; name: string; inHand: number; oldestInHandDays: number | null; completedThisMonth: number; returnedThisMonth: number }>;
}

/**
 * What the person's own RTOMs look like, for the dashboard of someone who works on service orders in an area: how many orders are with
 * contractors, how many each contractor has in hand and finished this month. Only reads; always limited to the person's areas.
 */
export class AreaOverviewService {
    static async forUser(userId: string): Promise<AreaOverview | null> {
        const scope = await resolveOpmcScope(userId);
        // A person with no area limit (company-wide) has no "own area": the company dashboards are for them.
        if (scope === undefined) return null;
        const now = new Date();
        const from = new Date(now.getFullYear(), now.getMonth(), 1);
        const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const month = from.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
        if (scope.length === 0) return { areas: [], month, totals: { notAssigned: 0, inHand: 0, completedThisMonth: 0, returnedThisMonth: 0, finishedNoContractor: 0 }, contractors: [] };
        const area = { opmcId: { in: scope } };
        const [areas, open, done, returned, finishedNoContractor] = await Promise.all([
            prisma.oPMC.findMany({ where: { id: { in: scope } }, select: { rtom: true, name: true }, orderBy: { rtom: 'asc' } }),
            prisma.serviceOrder.groupBy({ by: ['contractorId'], where: { ...area, sltsStatus: { in: [...IN_HAND] }, status: { notIn: ['COMPLETED', 'INSTALL_CLOSED', 'RETURN', 'DISAPPEARED'] } }, _count: { _all: true }, _min: { receivedDate: true } }),
            prisma.serviceOrder.groupBy({ by: ['contractorId'], where: { ...area, sltsStatus: { in: [...FINISHED] }, completedDate: { gte: from, lt: to } }, _count: { _all: true } }),
            prisma.serviceOrder.groupBy({ by: ['contractorId'], where: { ...area, sltsStatus: 'RETURN', completedDate: { gte: from, lt: to } }, _count: { _all: true } }),
            // Finished orders nobody has billed and no contractor is recorded on: they can not be invoiced until a contractor is assigned.
            prisma.serviceOrder.count({ where: { ...area, invoiced: false, contractorId: null, status: { in: ['COMPLETED', 'INSTALL_CLOSED', 'PAT_OPMC_PASSED', 'PAT_CORRECTED'] } } }),
        ]);
        const ids = [...new Set([...open, ...done, ...returned].map((r) => r.contractorId).filter((c): c is string => !!c))];
        const names = new Map((await prisma.contractor.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })).map((c) => [c.id, c.name]));
        const rows = new Map<string, AreaOverview['contractors'][number]>();
        const row = (id: string | null) => {
            const key = id ?? '-';
            if (!rows.has(key)) rows.set(key, { contractorId: id, name: id ? (names.get(id) ?? 'Contractor') : 'No contractor recorded', inHand: 0, oldestInHandDays: null, completedThisMonth: 0, returnedThisMonth: 0 });
            return rows.get(key)!;
        };
        for (const r of open) {
            const x = row(r.contractorId);
            x.inHand = r._count._all;
            x.oldestInHandDays = r._min.receivedDate ? Math.max(0, Math.floor((now.getTime() - r._min.receivedDate.getTime()) / 86_400_000)) : null;
        }
        for (const r of done) row(r.contractorId).completedThisMonth = r._count._all;
        for (const r of returned) row(r.contractorId).returnedThisMonth = r._count._all;
        // Orders with no contractor come last: they are not a contractor's progress, and they can not be invoiced until one is assigned.
        const contractors = [...rows.values()].sort((a, b) => Number(a.contractorId === null) - Number(b.contractorId === null) || b.inHand - a.inHand || b.completedThisMonth - a.completedThisMonth || a.name.localeCompare(b.name));
        // "With contractors" counts only orders a contractor really holds; the orders with no contractor are counted on their own.
        const sum = (f: (c: AreaOverview['contractors'][number]) => number) => contractors.filter((c) => c.contractorId !== null).reduce((a, c) => a + f(c), 0);
        return {
            areas, month, contractors,
            totals: {
                notAssigned: rows.get('-')?.inHand ?? 0, finishedNoContractor,
                inHand: sum((c) => c.inHand),
                completedThisMonth: sum((c) => c.completedThisMonth),
                returnedThisMonth: sum((c) => c.returnedThisMonth),
            },
        };
    }
}
