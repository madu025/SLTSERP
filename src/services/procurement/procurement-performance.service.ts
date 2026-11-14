import { prisma } from '@/lib/prisma';
import { StoreService } from '@/services/inventory/store.service';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { DAY_MS, LATE_BUCKETS, fulfilmentPct, lateBucket, lateDays, waitingFor, type LatePo, type ProcurementReport } from '@/lib/supply-chain-shared';

const OPEN_STORE_PO = ['PO_CREATED', 'PO_SENT', 'PO_CONFIRMED'];
const OPEN_PROJECT_PO = ['APPROVED', 'ISSUED', 'PARTIALLY_RECEIVED'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const cache = new Map<string, { at: number; value: Promise<ProcurementReport> }>();

/**
 * Procurement performance for both procurement systems.
 *
 * The store system (stock request -> PO -> GRN) is read from the request's procurement status and stage dates, because the
 * PO row's own status never moves after creation. The project system (requisition -> PO -> goods receipt) is read from
 * its PO statuses. Callers only see stores they can access and projects in their OPMC scope.
 */
export class ProcurementPerformanceService {
    static async getReport(userId: string | null, now = new Date()): Promise<ProcurementReport> {
        const scope = userId === null ? undefined : await resolveOpmcScope(userId);
        const storeIds = userId === null ? null : (await StoreService.getAccessibleStores(userId)).map((s) => s.id);
        const key = `${storeIds === null ? 'ALL' : [...storeIds].sort().join(',')}|${scope === undefined ? 'G' : scope.join(',')}`;
        const hit = cache.get(key);
        if (hit && Date.now() - hit.at < 60_000) return hit.value;
        const value = this.compute(storeIds, scope, now);
        cache.set(key, { at: Date.now(), value });
        value.catch(() => cache.delete(key));
        return value;
    }

    private static async compute(storeIds: string[] | null, scope: string[] | undefined, now: Date): Promise<ProcurementReport> {
        const requestScope = storeIds === null ? {} : { OR: [{ fromStoreId: { in: storeIds } }, { toStoreId: { in: storeIds } }] };
        const projectScope = scope === undefined ? {} : { project: { opmcId: { in: scope } } };
        const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));

        // ---- store system (batch of 3)
        const [storePos, pending, sources] = await Promise.all([
            prisma.purchaseOrder.findMany({
                where: { stockRequest: { procurementStatus: { in: OPEN_STORE_PO }, ...requestScope } },
                select: { id: true, poNumber: true, vendor: true, expectedDelivery: true, items: { select: { totalAmount: true } } },
                take: 1000,
            }),
            prisma.stockRequest.findMany({
                where: { status: 'PENDING', ...requestScope },
                select: { createdAt: true, armDate: true, storesManagerDate: true, hsOspDate: true, managerDate: true, releasedDate: true },
                take: 3000,
            }),
            prisma.stockRequest.groupBy({ by: ['sourceType'], where: { createdAt: { gte: new Date(now.getTime() - 90 * DAY_MS) }, ...requestScope }, _count: { _all: true } }),
        ]);

        const latePos: LatePo[] = [];
        const bucketCount = new Map<string, number>(LATE_BUCKETS.map((b) => [b, 0]));
        let noDate = 0;
        for (const po of storePos) {
            const days = lateDays(po.expectedDelivery, now);
            if (!po.expectedDelivery) noDate++;
            if (days !== null) {
                const b = lateBucket(days);
                bucketCount.set(b, (bucketCount.get(b) ?? 0) + 1);
                latePos.push({ id: po.id, poNumber: po.poNumber, vendor: po.vendor, system: 'STORE', expectedDelivery: po.expectedDelivery!.toISOString(), daysLate: days, bucket: b, amount: po.items.reduce((a, i) => a + Number(i.totalAmount), 0), href: '/procurement/orders' });
            }
        }

        const waiting = new Map<string, { count: number; oldest: number | null }>();
        for (const r of pending) {
            const label = waitingFor(r.armDate, r.storesManagerDate, r.hsOspDate, r.managerDate, r.releasedDate);
            if (!label) continue;
            const stamp = [r.managerDate, r.hsOspDate, r.storesManagerDate, r.armDate].find(Boolean) ?? r.createdAt;
            const age = Math.floor((now.getTime() - new Date(stamp as Date).getTime()) / DAY_MS);
            const w = waiting.get(label) ?? { count: 0, oldest: null };
            w.count++; w.oldest = w.oldest === null ? age : Math.max(w.oldest, age);
            waiting.set(label, w);
        }

        // ---- store lead time (batch of 2)
        const [leadAll, leadMonthly] = await Promise.all([
            prisma.$queryRawUnsafe<{ n: bigint | number; avg: unknown; p50: unknown; p90: unknown }[]>(
                `SELECT count(*) AS n, avg(d) AS avg, percentile_cont(0.5) WITHIN GROUP (ORDER BY d) AS p50, percentile_cont(0.9) WITHIN GROUP (ORDER BY d) AS p90
                 FROM (SELECT EXTRACT(EPOCH FROM ("receivedDate" - "createdAt")) / 86400.0 AS d FROM "StockRequest"
                       WHERE "receivedDate" IS NOT NULL AND "receivedDate" >= "createdAt" AND "receivedDate" >= $2::timestamptz
                         AND ($1::uuid[] IS NULL OR "fromStoreId" = ANY($1::uuid[]) OR "toStoreId" = ANY($1::uuid[]))) t`,
                storeIds, new Date(now.getTime() - 180 * DAY_MS),
            ),
            prisma.$queryRawUnsafe<{ m: Date; n: bigint | number; avg: unknown }[]>(
                `SELECT date_trunc('month', "receivedDate" AT TIME ZONE 'UTC') AS m, count(*) AS n, avg(EXTRACT(EPOCH FROM ("receivedDate" - "createdAt")) / 86400.0) AS avg
                 FROM "StockRequest" WHERE "receivedDate" IS NOT NULL AND "receivedDate" >= "createdAt" AND "receivedDate" >= $2::timestamptz
                   AND ($1::uuid[] IS NULL OR "fromStoreId" = ANY($1::uuid[]) OR "toStoreId" = ANY($1::uuid[])) GROUP BY 1`,
                storeIds, since,
            ),
        ]);
        const round1 = (v: unknown) => (v === null || v === undefined ? null : Number(Number(v).toFixed(1)));
        const monthly = new Map(leadMonthly.map((r) => [new Date(r.m).toISOString().slice(0, 7), { n: Number(r.n), avg: round1(r.avg) }]));
        const leadTimeMonthly = Array.from({ length: 6 }, (_, i) => {
            const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + i, 1));
            const m = monthly.get(d.toISOString().slice(0, 7));
            return { label: MONTHS[d.getUTCMonth()], avgDays: m?.avg ?? null, completed: m?.n ?? 0 };
        });

        // ---- project system (batch of 3)
        const [funnel, projectPos, pendingApproval] = await Promise.all([
            prisma.projectPurchaseOrder.groupBy({ by: ['status'], where: projectScope, _count: { _all: true }, _sum: { totalAmount: true } }),
            prisma.projectPurchaseOrder.findMany({
                where: { status: { in: OPEN_PROJECT_PO }, ...projectScope },
                select: { id: true, poNumber: true, vendorName: true, expectedDelivery: true, totalAmount: true, projectId: true, items: { select: { quantity: true, receivedQty: true } } },
                take: 1000,
            }),
            prisma.projectPurchaseOrder.aggregate({ where: { status: 'PENDING_APPROVAL', ...projectScope }, _count: { _all: true }, _min: { createdAt: true } }),
        ]);
        let projectLate = 0, ordered = 0, accepted = 0;
        for (const po of projectPos) {
            for (const i of po.items) { ordered += Number(i.quantity); accepted += Number(i.receivedQty); }
            const days = lateDays(po.expectedDelivery, now);
            if (days !== null) {
                projectLate++;
                latePos.push({ id: po.id, poNumber: po.poNumber, vendor: po.vendorName, system: 'PROJECT', expectedDelivery: po.expectedDelivery!.toISOString(), daysLate: days, bucket: lateBucket(days), amount: Number(po.totalAmount), href: `/projects/${po.projectId}` });
            }
        }
        latePos.sort((a, b) => (b.daysLate ?? 0) - (a.daysLate ?? 0));

        const order = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ISSUED', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'CLOSED', 'CANCELLED'];
        return {
            asOf: now.toISOString(),
            store: {
                openPos: storePos.length,
                late: latePos.filter((p) => p.system === 'STORE').length,
                noDeliveryDate: noDate,
                lateBuckets: LATE_BUCKETS.map((b) => ({ bucket: b, count: bucketCount.get(b) ?? 0 })),
                waiting: [...waiting.entries()].map(([label, w]) => ({ label, count: w.count, oldestDays: w.oldest })),
                leadTime: { avgDays: round1(leadAll[0]?.avg), medianDays: round1(leadAll[0]?.p50), p90Days: round1(leadAll[0]?.p90), completed: Number(leadAll[0]?.n ?? 0) },
                leadTimeMonthly,
                sourceMix: sources.map((s) => ({ source: s.sourceType, count: s._count._all })).sort((a, b) => b.count - a.count),
            },
            project: {
                funnel: funnel.map((f) => ({ status: f.status, count: f._count._all, amount: Number(f._sum.totalAmount ?? 0) })).sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status)),
                late: projectLate,
                pendingApproval: {
                    count: pendingApproval._count._all,
                    oldestDays: pendingApproval._min.createdAt ? Math.floor((now.getTime() - pendingApproval._min.createdAt.getTime()) / DAY_MS) : null,
                },
                fulfilmentPct: fulfilmentPct(accepted, ordered),
            },
            latePos: latePos.slice(0, 50),
        };
    }
}
