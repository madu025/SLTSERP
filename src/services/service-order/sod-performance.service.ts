import { prisma } from '@/lib/prisma';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import {
    SOD_FINANCIAL_COMPLETION_STATUSES,
    SOD_OPEN_SLTS_STATUSES,
    SOD_TURNAROUND_SLA_DAYS,
} from '@/lib/constants/sod-constants';
import { SODReturnClassifierService } from './sod-return-classifier.service';
import {
    ageBucket, slaPct, daysToClear, emptyBuckets, AGE_BUCKETS,
    type AgeBucket, type TurnaroundRow, type AgeingRow, type CapacityRow, type TeamProductivityRow, type ReasonRow, type SodPerformanceReport,
} from '@/lib/sod-performance-shared';

export { ageBucket, slaPct, daysToClear, emptyBuckets, AGE_BUCKETS };
export type { AgeBucket, TurnaroundRow, AgeingRow, CapacityRow, TeamProductivityRow, ReasonRow, SodPerformanceReport };

const DAY_MS = 24 * 3600 * 1000;

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const round1 = (v: number | null) => (v === null ? null : Number(v.toFixed(1)));

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { at: number; value: Promise<SodPerformanceReport> }>();

/**
 * Service-order performance for management: turnaround and SLA compliance, ageing of the open backlog,
 * recovery capacity, return reasons and team productivity.
 *
 * Every view is one SQL aggregate (about 100k order rows), scoped to the caller's OPMCs, and the whole report
 * is cached for 60 s per scope and window. Rows whose completion precedes their receipt (bad source data) and
 * rows missing either date are excluded from turnaround, never guessed.
 */
export class SodPerformanceService {
    static async getReport(userId: string | null | undefined, from: Date, to: Date, now = new Date()): Promise<SodPerformanceReport> {
        const scope = await resolveOpmcScope(userId);
        const key = `${scope === undefined ? 'ALL' : scope.join(',')}|${from.toISOString()}|${to.toISOString()}`;
        const hit = cache.get(key);
        if (hit && now.getTime() - hit.at < CACHE_TTL_MS) return hit.value;
        const value = this.compute(scope, from, to, now);
        cache.set(key, { at: now.getTime(), value });
        value.catch(() => cache.delete(key));
        if (cache.size > 50) cache.delete(cache.keys().next().value as string);
        return value;
    }

    /**
     * Two cheap company-wide figures for management alerts: SLA compliance over the last 30 days and the RTOMs
     * holding the most orders open longer than 14 days. Callers must already have company-wide access.
     */
    static async getHeadline(now = new Date()): Promise<{ completed30d: number; slaPct30d: number | null; worstRtoms: { rtom: string; over14: number; open: number }[] }> {
        const done = [...SOD_FINANCIAL_COMPLETION_STATUSES] as string[];
        const open = [...SOD_OPEN_SLTS_STATUSES] as string[];
        const from = new Date(now.getTime() - 30 * DAY_MS);
        const [sla, aged] = await Promise.all([
            prisma.$queryRawUnsafe<{ n: bigint | number; within: bigint | number }[]>(
                `SELECT count(*) AS n, count(*) FILTER (WHERE EXTRACT(EPOCH FROM ("completedDate" - "receivedDate")) / 86400.0 <= $4) AS within
                 FROM "ServiceOrder" WHERE "status"::text = ANY($1::text[]) AND "receivedDate" IS NOT NULL
                   AND "completedDate" >= $2::timestamptz AND "completedDate" <= $3::timestamptz AND "completedDate" >= "receivedDate"`,
                done, from, now, SOD_TURNAROUND_SLA_DAYS,
            ),
            prisma.$queryRawUnsafe<{ rtom: string | null; over14: bigint | number; open: bigint | number }[]>(
                `SELECT "rtom", count(*) FILTER (WHERE "receivedDate" < $2::timestamptz - interval '14 days') AS over14, count(*) AS open
                 FROM "ServiceOrder" WHERE "sltsStatus"::text = ANY($1::text[]) AND "receivedDate" IS NOT NULL
                 GROUP BY 1 HAVING count(*) FILTER (WHERE "receivedDate" < $2::timestamptz - interval '14 days') > 0 ORDER BY 2 DESC LIMIT 3`,
                open, now,
            ),
        ]);
        const completed = Number(sla[0]?.n ?? 0);
        return {
            completed30d: completed,
            slaPct30d: slaPct(Number(sla[0]?.within ?? 0), completed),
            worstRtoms: aged.map((r) => ({ rtom: String(r.rtom ?? 'Unknown'), over14: Number(r.over14), open: Number(r.open) })),
        };
    }

    private static async compute(scope: string[] | undefined, from: Date, to: Date, now: Date): Promise<SodPerformanceReport> {
        const scopeArr = scope === undefined ? null : scope;
        const done = [...SOD_FINANCIAL_COMPLETION_STATUSES] as string[];
        const open = [...SOD_OPEN_SLTS_STATUSES] as string[];
        const sla = SOD_TURNAROUND_SLA_DAYS;
        const since14 = new Date(now.getTime() - 14 * DAY_MS);

        type TurnRaw = { k: string | null; label: string | null; n: bigint | number; avg: unknown; p50: unknown; p90: unknown; within: bigint | number };
        const turnaround = (groupCol: 'rtom' | 'contractor' | 'all') => {
            const keyExpr = groupCol === 'rtom' ? `so."rtom"` : groupCol === 'contractor' ? `so."contractorId"::text` : `'ALL'`;
            const labelExpr = groupCol === 'contractor' ? `COALESCE(c."name", 'Unassigned')` : groupCol === 'rtom' ? `so."rtom"` : `'All orders'`;
            const join = groupCol === 'contractor' ? `LEFT JOIN "Contractor" c ON c."id" = so."contractorId"` : '';
            return prisma.$queryRawUnsafe<TurnRaw[]>(
                `SELECT ${keyExpr} AS k, ${labelExpr} AS label, count(*) AS n,
                        avg(d) AS avg, percentile_cont(0.5) WITHIN GROUP (ORDER BY d) AS p50, percentile_cont(0.9) WITHIN GROUP (ORDER BY d) AS p90,
                        count(*) FILTER (WHERE d <= $5) AS within
                 FROM (SELECT so."rtom", so."contractorId", EXTRACT(EPOCH FROM (so."completedDate" - so."receivedDate")) / 86400.0 AS d
                       FROM "ServiceOrder" so
                       WHERE so."status"::text = ANY($1::text[]) AND so."receivedDate" IS NOT NULL
                         AND so."completedDate" >= $2::timestamptz AND so."completedDate" <= $3::timestamptz
                         AND so."completedDate" >= so."receivedDate"
                         AND ($4::uuid[] IS NULL OR so."opmcId" = ANY($4::uuid[]))) so
                 ${join}
                 GROUP BY 1, 2 ORDER BY n DESC LIMIT 60`,
                done, from, to, scopeArr, sla,
            );
        };
        const toTurn = (r: TurnRaw): TurnaroundRow => {
            const completed = Number(r.n);
            const within = Number(r.within);
            return {
                key: String(r.k ?? 'NONE'), label: String(r.label ?? 'Unknown'), completed,
                avgDays: round1(num(r.avg)), medianDays: round1(num(r.p50)), p90Days: round1(num(r.p90)),
                withinSla: within, slaPct: slaPct(within, completed),
            };
        };

        type AgeRaw = { k: string | null; label: string | null; open: bigint | number; b0: bigint | number; b1: bigint | number; b2: bigint | number; b3: bigint | number; b4: bigint | number };
        const ageing = (groupCol: 'rtom' | 'contractor') => {
            const keyExpr = groupCol === 'rtom' ? `so."rtom"` : `so."contractorId"::text`;
            const labelExpr = groupCol === 'rtom' ? `so."rtom"` : `COALESCE(c."name", 'Unassigned')`;
            const join = groupCol === 'contractor' ? `LEFT JOIN "Contractor" c ON c."id" = so."contractorId"` : '';
            return prisma.$queryRawUnsafe<AgeRaw[]>(
                `SELECT ${keyExpr} AS k, ${labelExpr} AS label, count(*) AS open,
                        count(*) FILTER (WHERE age < 3) AS b0, count(*) FILTER (WHERE age >= 3 AND age < 7) AS b1,
                        count(*) FILTER (WHERE age >= 7 AND age < 14) AS b2, count(*) FILTER (WHERE age >= 14 AND age < 30) AS b3,
                        count(*) FILTER (WHERE age >= 30) AS b4
                 FROM (SELECT so."rtom", so."contractorId", EXTRACT(EPOCH FROM ($2::timestamptz - so."receivedDate")) / 86400.0 AS age
                       FROM "ServiceOrder" so
                       WHERE so."sltsStatus"::text = ANY($1::text[]) AND so."receivedDate" IS NOT NULL
                         AND ($3::uuid[] IS NULL OR so."opmcId" = ANY($3::uuid[]))) so
                 ${join}
                 GROUP BY 1, 2 ORDER BY open DESC LIMIT 60`,
                open, now, scopeArr,
            );
        };
        const toAge = (r: AgeRaw): AgeingRow => {
            const buckets: Record<AgeBucket, number> = { '0-3': Number(r.b0), '3-7': Number(r.b1), '7-14': Number(r.b2), '14-30': Number(r.b3), '30+': Number(r.b4) };
            return { key: String(r.k ?? 'NONE'), label: String(r.label ?? 'Unknown'), open: Number(r.open), buckets, over14: buckets['14-30'] + buckets['30+'] };
        };

        // Batch 1 (3 concurrent): turnaround
        const [overallRaw, byRtomRaw, byContractorRaw] = await Promise.all([turnaround('all'), turnaround('rtom'), turnaround('contractor')]);
        // Batch 2 (2 concurrent): ageing
        const [ageRtomRaw, ageContractorRaw] = await Promise.all([ageing('rtom'), ageing('contractor')]);

        // Batch 3 (3 concurrent): capacity, return reasons, team productivity
        const [recentRaw, returnRaw, teamRaw] = await Promise.all([
            prisma.$queryRawUnsafe<{ k: string | null; n: bigint | number }[]>(
                `SELECT so."rtom" AS k, count(*) AS n FROM "ServiceOrder" so
                 WHERE so."status"::text = ANY($1::text[]) AND so."completedDate" >= $2::timestamptz AND so."completedDate" <= $3::timestamptz
                   AND ($4::uuid[] IS NULL OR so."opmcId" = ANY($4::uuid[])) GROUP BY 1`,
                done, since14, now, scopeArr,
            ),
            prisma.$queryRawUnsafe<{ reason: string | null; n: bigint | number }[]>(
                `SELECT so."returnReason" AS reason, count(*) AS n FROM "ServiceOrder" so
                 WHERE so."sltsStatus"::text = 'RETURN' AND so."statusDate" >= $1::timestamptz AND so."statusDate" <= $2::timestamptz
                   AND ($3::uuid[] IS NULL OR so."opmcId" = ANY($3::uuid[])) GROUP BY 1`,
                from, to, scopeArr,
            ),
            prisma.$queryRawUnsafe<{ id: string; team: string; contractor: string | null; n: bigint | number; days: bigint | number }[]>(
                `SELECT t."id"::text AS id, t."name" AS team, c."name" AS contractor, count(*) AS n, count(DISTINCT so."completedDate"::date) AS days
                 FROM "ServiceOrder" so JOIN "ContractorTeam" t ON t."id" = so."teamId" LEFT JOIN "Contractor" c ON c."id" = t."contractorId"
                 WHERE so."status"::text = ANY($1::text[]) AND so."completedDate" >= $2::timestamptz AND so."completedDate" <= $3::timestamptz
                   AND ($4::uuid[] IS NULL OR so."opmcId" = ANY($4::uuid[]))
                 GROUP BY 1, 2, 3 ORDER BY n DESC LIMIT 40`,
                done, from, to, scopeArr,
            ),
        ]);

        const ageingByRtom = ageRtomRaw.map(toAge);
        const recentBy = new Map(recentRaw.map((r) => [String(r.k ?? 'NONE'), Number(r.n)]));
        const capacityByRtom: CapacityRow[] = ageingByRtom.map((a) => {
            const completed = recentBy.get(a.key) ?? 0;
            return { key: a.key, label: a.label, open: a.open, completedLast14Days: completed, perDay: Number((completed / 14).toFixed(1)), daysToClear: daysToClear(a.open, completed) };
        }).sort((a, b) => (b.daysToClear ?? Number.POSITIVE_INFINITY) - (a.daysToClear ?? Number.POSITIVE_INFINITY));

        // Return reasons: classify each distinct text once, then total by category
        const byCategory = new Map<string, number>();
        let returned = 0;
        for (const r of returnRaw) {
            const n = Number(r.n);
            returned += n;
            const category = r.reason ? SODReturnClassifierService.classify(r.reason).category : 'NO_REASON';
            byCategory.set(category, (byCategory.get(category) ?? 0) + n);
        }
        const returnReasons: ReasonRow[] = [...byCategory.entries()]
            .map(([category, count]) => ({ category, count, pct: returned > 0 ? Number(((count / returned) * 100).toFixed(1)) : 0 }))
            .sort((a, b) => b.count - a.count);

        const overall = overallRaw[0] ? toTurn(overallRaw[0]) : { key: 'ALL', label: 'All orders', completed: 0, avgDays: null, medianDays: null, p90Days: null, withinSla: 0, slaPct: null };
        return {
            from: from.toISOString(), to: to.toISOString(), slaDays: sla, overall,
            turnaroundByRtom: byRtomRaw.map(toTurn), turnaroundByContractor: byContractorRaw.map(toTurn),
            ageingByRtom, ageingByContractor: ageContractorRaw.map(toAge), capacityByRtom,
            returnReasons, returnedOrders: returned,
            teamProductivity: teamRaw.map((t) => ({
                teamId: t.id, teamName: t.team, contractorName: t.contractor ?? 'Unknown', completed: Number(t.n), activeDays: Number(t.days),
                perActiveDay: Number(t.days) > 0 ? Number((Number(t.n) / Number(t.days)).toFixed(1)) : null,
            })),
            notes: [
                `Turnaround is received date to completed date for orders completed in the window; target ${sla} days. Orders missing a date, or completed before they were received, are excluded.`,
                'The average is pulled up by a small number of very old orders, so the median and the 90th percentile are the figures to manage by.',
                'Backlog is orders still open at SLT (in progress or assigned), aged from the received date. Orders with no received date cannot be aged and are not counted.',
                'Delay reasons are not currently captured on service orders, so there is no delay-reason analysis; returns are grouped by the classifier of the free-text return reason.',
            ],
        };
    }
}
