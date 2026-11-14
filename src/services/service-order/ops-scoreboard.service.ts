import { prisma } from '@/lib/prisma';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { SodPerformanceService } from './sod-performance.service';
import { healthScore, type OpsScoreboard, type ScoreboardRow } from '@/lib/ops-scoreboard-shared';
import { SOD_TURNAROUND_SLA_DAYS } from '@/lib/constants/sod-constants';

const DAY_MS = 24 * 3600 * 1000;

/**
 * RTOM scoreboard for the operations dashboard: backlog and ageing, SLA, returns, recovery time and the projects
 * running in each RTOM's OPMC, side by side with one health number to rank on.
 *
 * It reuses the cached SOD performance aggregates (so the figures here always match the performance page) and adds two
 * small aggregates for returns and projects. Everything is limited to the caller's OPMCs.
 */
export class OpsScoreboardService {
    static async getScoreboard(
        userId: string | null | undefined,
        filters: { region?: string; rtom?: string; windowDays?: number } = {},
        now = new Date(),
    ): Promise<OpsScoreboard> {
        const windowDays = Math.min(180, Math.max(7, filters.windowDays ?? 30));
        const from = new Date(now.getTime() - windowDays * DAY_MS);
        const scope = await resolveOpmcScope(userId);
        const scopeArr = scope === undefined ? null : scope;

        const [perf, opmcs] = await Promise.all([
            SodPerformanceService.getReport(userId, from, now, now),
            prisma.oPMC.findMany({ select: { id: true, rtom: true, region: true } }),
        ]);

        const [returnRows, projectRows] = await Promise.all([
            prisma.$queryRawUnsafe<{ rtom: string | null; n: bigint | number }[]>(
                `SELECT so."rtom", count(*) AS n FROM "ServiceOrder" so
                 WHERE so."sltsStatus"::text = 'RETURN' AND so."statusDate" >= $1::timestamptz AND so."statusDate" <= $2::timestamptz
                   AND ($3::uuid[] IS NULL OR so."opmcId" = ANY($3::uuid[])) GROUP BY 1`,
                from, now, scopeArr,
            ),
            prisma.project.groupBy({
                by: ['opmcId'],
                where: { status: { in: ['IN_PROGRESS', 'ON_HOLD'] }, ...(scope === undefined ? {} : { opmcId: { in: scope } }) },
                _count: { _all: true },
            }),
        ]);
        const delayedRows = await prisma.project.groupBy({
            by: ['opmcId'],
            where: { status: { in: ['IN_PROGRESS', 'ON_HOLD'] }, endDate: { lt: now }, ...(scope === undefined ? {} : { opmcId: { in: scope } }) },
            _count: { _all: true },
        });

        const regionOf = new Map(opmcs.map((o) => [o.rtom, o.region]));
        const rtomOfOpmc = new Map(opmcs.map((o) => [o.id, o.rtom]));
        const returnedBy = new Map(returnRows.map((r) => [String(r.rtom ?? 'NONE'), Number(r.n)]));
        const addBy = (rows: { opmcId: string | null; _count: { _all: number } }[]) => {
            const m = new Map<string, number>();
            for (const r of rows) { const rtom = r.opmcId ? rtomOfOpmc.get(r.opmcId) : undefined; if (rtom) m.set(rtom, (m.get(rtom) ?? 0) + r._count._all); }
            return m;
        };
        const activeBy = addBy(projectRows);
        const delayedBy = addBy(delayedRows);
        const turnBy = new Map(perf.turnaroundByRtom.map((t) => [t.key, t]));
        const capBy = new Map(perf.capacityByRtom.map((c) => [c.key, c]));

        const keys = new Set<string>([...perf.ageingByRtom.map((a) => a.key), ...perf.turnaroundByRtom.map((t) => t.key), ...returnedBy.keys()]);
        let rows: ScoreboardRow[] = [...keys].map((rtom) => {
            const age = perf.ageingByRtom.find((a) => a.key === rtom);
            const turn = turnBy.get(rtom);
            const returned = returnedBy.get(rtom) ?? 0;
            const completed = turn?.completed ?? 0;
            const handled = completed + returned;
            const open = age?.open ?? 0;
            const over14 = age?.over14 ?? 0;
            const agedPct = open > 0 ? Number(((over14 / open) * 100).toFixed(1)) : null;
            const returnRatePct = handled > 0 ? Number(((returned / handled) * 100).toFixed(1)) : null;
            return {
                rtom, region: regionOf.get(rtom) ?? null, open, over14, agedPct, completed,
                slaPct: turn?.slaPct ?? null, medianDays: turn?.medianDays ?? null, returned, returnRatePct,
                daysToClear: capBy.get(rtom)?.daysToClear ?? null,
                activeProjects: activeBy.get(rtom) ?? 0, delayedProjects: delayedBy.get(rtom) ?? 0,
                health: healthScore(turn?.slaPct ?? null, agedPct, returnRatePct),
            };
        });

        if (filters.region && filters.region !== 'ALL') rows = rows.filter((r) => r.region === filters.region);
        if (filters.rtom && filters.rtom !== 'ALL') rows = rows.filter((r) => r.rtom === filters.rtom);
        rows.sort((a, b) => (a.health ?? 101) - (b.health ?? 101)); // weakest first: that is where attention goes

        const sum = (f: (r: ScoreboardRow) => number) => rows.reduce((a, r) => a + f(r), 0);
        const within = rows.reduce((a, r) => a + Math.round(((r.slaPct ?? 0) / 100) * r.completed), 0);
        const completed = sum((r) => r.completed);
        return {
            windowDays, slaDays: SOD_TURNAROUND_SLA_DAYS, rows,
            totals: {
                open: sum((r) => r.open), over14: sum((r) => r.over14), completed, slaPct: completed > 0 ? Number(((within / completed) * 100).toFixed(1)) : null,
                returned: sum((r) => r.returned), activeProjects: sum((r) => r.activeProjects), delayedProjects: sum((r) => r.delayedProjects),
            },
            notes: [
                `Window: last ${windowDays} days. SLA is completed within ${SOD_TURNAROUND_SLA_DAYS} days of receipt; "aged" is open for more than 14 days.`,
                'Health is the average of SLA compliance, backlog not aged and returns under control; weakest RTOMs are listed first.',
                'Projects are those in progress or on hold in the RTOM\'s OPMC; "delayed" means past the planned end date.',
            ],
        };
    }
}
