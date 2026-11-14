import { prisma } from '@/lib/prisma';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { SOD_FINANCIAL_COMPLETION_STATUSES, SOD_TURNAROUND_SLA_DAYS } from '@/lib/constants/sod-constants';
import {
    scoreContractor, monthRange, SCORE_WEIGHTS, PRODUCTIVITY_BENCHMARK_PER_TEAM_DAY, MIN_ORDERS_FOR_RANKING, RETURN_RATE_ZERO_SCORE_PCT,
    type ContractorMonthMetrics, type ContractorScorecardReport, type ContractorScorecardRow, type ContractorMonthRow,
} from '@/lib/contractor-scorecard-shared';

const PAT_PASS = ['PAT_PASSED', 'PASSED', 'APPROVED'];
const PAT_FAIL = ['REJECTED', 'PAT_REJECTED', 'CORRECTED'];
const empty = (): ContractorMonthMetrics => ({ completed: 0, withinSla: 0, patPassed: 0, patFailed: 0, returned: 0, activeDays: 0, teams: 0 });

const currentMonth = (now: Date) => `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

/**
 * Contractor league table built from service-order outcomes, not from project tasks: SLA compliance, SLT PAT pass rate,
 * return rate and output per team-day, per contractor and month, with a six-month trend.
 *
 * Derived on demand from the orders (one aggregate for completions, one for returns), so nothing is stored that could
 * go stale. Only orders that carry a contractor can be scored; the report says how many do not.
 */
export class ContractorScorecardService {
    static async getScorecard(userId: string | null | undefined, month?: string, trendMonths = 6, now = new Date()): Promise<ContractorScorecardReport> {
        const scope = await resolveOpmcScope(userId);
        return this.compute(scope === undefined ? null : scope, month ?? currentMonth(now), trendMonths);
    }

    /** Company-wide view for management alerts; callers must already hold company-wide access. */
    static async getCompanyScorecard(month?: string, trendMonths = 2, now = new Date()): Promise<ContractorScorecardReport> {
        return this.compute(null, month ?? currentMonth(now), trendMonths);
    }

    private static async compute(scope: string[] | null, month: string, trendMonths: number): Promise<ContractorScorecardReport> {
        const months = monthRange(month, Math.max(1, Math.min(12, trendMonths)));
        const from = new Date(`${months[0]}-01T00:00:00.000Z`);
        const [y, m] = month.split('-').map(Number);
        const to = new Date(Date.UTC(y, m, 1) - 1);
        const done = [...SOD_FINANCIAL_COMPLETION_STATUSES] as string[];

        type DoneRaw = { cid: string | null; m: string; completed: bigint | number; within: bigint | number; pass: bigint | number; fail: bigint | number; days: bigint | number; teams: bigint | number };
        const [doneRows, returnRows] = await Promise.all([
            prisma.$queryRawUnsafe<DoneRaw[]>(
                `SELECT so."contractorId"::text AS cid, to_char(so."completedDate", 'YYYY-MM') AS m, count(*) AS completed,
                        count(*) FILTER (WHERE so."receivedDate" IS NOT NULL AND so."completedDate" >= so."receivedDate"
                                         AND EXTRACT(EPOCH FROM (so."completedDate" - so."receivedDate")) / 86400.0 <= $5) AS within,
                        count(*) FILTER (WHERE so."sltsPatStatus"::text = ANY($6::text[])) AS pass,
                        count(*) FILTER (WHERE so."sltsPatStatus"::text = ANY($7::text[])) AS fail,
                        count(DISTINCT so."completedDate"::date) AS days, count(DISTINCT so."teamId") AS teams
                 FROM "ServiceOrder" so
                 WHERE so."status"::text = ANY($1::text[]) AND so."completedDate" >= $2::timestamptz AND so."completedDate" <= $3::timestamptz
                   AND ($4::uuid[] IS NULL OR so."opmcId" = ANY($4::uuid[]))
                 GROUP BY 1, 2`,
                done, from, to, scope, SOD_TURNAROUND_SLA_DAYS, PAT_PASS, PAT_FAIL,
            ),
            prisma.$queryRawUnsafe<{ cid: string | null; m: string; n: bigint | number }[]>(
                `SELECT so."contractorId"::text AS cid, to_char(so."statusDate", 'YYYY-MM') AS m, count(*) AS n
                 FROM "ServiceOrder" so
                 WHERE so."sltsStatus"::text = 'RETURN' AND so."statusDate" >= $1::timestamptz AND so."statusDate" <= $2::timestamptz
                   AND ($3::uuid[] IS NULL OR so."opmcId" = ANY($3::uuid[]))
                 GROUP BY 1, 2`,
                from, to, scope,
            ),
        ]);

        const metrics = new Map<string, Map<string, ContractorMonthMetrics>>();
        const slot = (cid: string, mo: string) => {
            const byMonth = metrics.get(cid) ?? new Map<string, ContractorMonthMetrics>();
            metrics.set(cid, byMonth);
            const cur = byMonth.get(mo) ?? empty();
            byMonth.set(mo, cur);
            return cur;
        };
        let unassigned = 0;
        let total = 0;
        for (const r of doneRows) {
            const completed = Number(r.completed);
            if (r.m === month) total += completed;
            if (!r.cid) { if (r.m === month) unassigned += completed; continue; }
            Object.assign(slot(r.cid, r.m), { completed, withinSla: Number(r.within), patPassed: Number(r.pass), patFailed: Number(r.fail), activeDays: Number(r.days), teams: Number(r.teams) });
        }
        for (const r of returnRows) if (r.cid) slot(r.cid, r.m).returned = Number(r.n);

        const names = new Map<string, string>();
        const ids = [...metrics.keys()];
        if (ids.length) for (const c of await prisma.contractor.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })) names.set(c.id, c.name);

        const rows: ContractorScorecardRow[] = [];
        for (const [cid, byMonth] of metrics) {
            const cur = byMonth.get(month);
            if (!cur) continue;
            const row = (mo: string, mm: ContractorMonthMetrics): ContractorMonthRow => ({ month: mo, ...mm, ...scoreContractor(mm) });
            const current = row(month, cur);
            const trend = months.map((mo) => { const mm = byMonth.get(mo); const s = mm ? scoreContractor(mm) : null; return { month: mo, score: s?.score ?? null, completed: mm?.completed ?? 0 }; });
            const prev = trend.length >= 2 ? trend[trend.length - 2] : null;
            rows.push({
                contractorId: cid, name: names.get(cid) ?? 'Unknown contractor', current, trend,
                change: current.score !== null && prev && prev.score !== null ? Number((current.score - prev.score).toFixed(1)) : null,
            });
        }
        // Ranked rows first (enough volume), best score first; thin-volume contractors follow
        rows.sort((a, b) => Number(a.current.lowVolume) - Number(b.current.lowVolume) || (b.current.score ?? -1) - (a.current.score ?? -1));

        return {
            month, months, rows, unassignedCompleted: unassigned, totalCompleted: total,
            notes: [
                `Score = weighted average of SLA compliance within ${SOD_TURNAROUND_SLA_DAYS} days (${SCORE_WEIGHTS.sla}%), SLT PAT pass rate (${SCORE_WEIGHTS.quality}%), returns (${SCORE_WEIGHTS.returns}%: ${RETURN_RATE_ZERO_SCORE_PCT}% returns scores zero) and output per team-day (${SCORE_WEIGHTS.productivity}%: ${PRODUCTIVITY_BENCHMARK_PER_TEAM_DAY} per team-day scores full). A component with no data is left out and the others are re-weighted.`,
                `Contractors with fewer than ${MIN_ORDERS_FOR_RANKING} completed orders in the month are listed after the ranked ones and are never flagged.`,
                'Material-deviation is not part of the score yet: SLT-reported material is barely captured, so there is nothing to compare against.',
                'Only service orders that carry a contractor can be scored.',
            ],
        };
    }
}
