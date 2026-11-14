/**
 * Contractor scorecard: types and the scoring rules. Client-safe (no server imports) so the page can show the
 * weights it is scored by.
 */

/** Completions per team per working day that earns a full productivity score. */
export const PRODUCTIVITY_BENCHMARK_PER_TEAM_DAY = 2;
/** Fewer completed orders than this in a month and the figures are too thin to rank on. */
export const MIN_ORDERS_FOR_RANKING = 5;
/** Return rate (% of orders finished or returned) at which the returns score reaches zero. */
export const RETURN_RATE_ZERO_SCORE_PCT = 20;

/** Share of the overall score each component carries. Re-normalised when a component has no data. */
export const SCORE_WEIGHTS = { sla: 35, quality: 30, returns: 20, productivity: 15 } as const;
export type ScoreComponent = keyof typeof SCORE_WEIGHTS;

export interface ContractorMonthMetrics {
    completed: number;
    withinSla: number;
    patPassed: number;
    patFailed: number;
    returned: number;
    activeDays: number;
    teams: number;
}

export interface ContractorScore {
    score: number | null;
    slaPct: number | null;
    patPassPct: number | null;
    returnRatePct: number | null;
    perTeamDay: number | null;
    components: Partial<Record<ScoreComponent, number>>;
    lowVolume: boolean;
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));

export function scoreContractor(m: ContractorMonthMetrics): ContractorScore {
    const slaPct = m.completed > 0 ? r1((m.withinSla / m.completed) * 100) : null;
    const decided = m.patPassed + m.patFailed;
    const patPassPct = decided > 0 ? r1((m.patPassed / decided) * 100) : null;
    const handled = m.completed + m.returned;
    const returnRatePct = handled > 0 ? r1((m.returned / handled) * 100) : null;
    const perTeamDay = m.activeDays > 0 ? r1(m.completed / (m.activeDays * Math.max(1, m.teams))) : null;

    const components: Partial<Record<ScoreComponent, number>> = {};
    if (slaPct !== null) components.sla = slaPct;
    if (patPassPct !== null) components.quality = patPassPct;
    if (returnRatePct !== null) components.returns = r1(clamp(100 - (returnRatePct / RETURN_RATE_ZERO_SCORE_PCT) * 100));
    if (perTeamDay !== null) components.productivity = r1(clamp((perTeamDay / PRODUCTIVITY_BENCHMARK_PER_TEAM_DAY) * 100));

    let weighted = 0;
    let weightSum = 0;
    for (const key of Object.keys(components) as ScoreComponent[]) {
        weighted += components[key]! * SCORE_WEIGHTS[key];
        weightSum += SCORE_WEIGHTS[key];
    }
    return {
        score: weightSum > 0 ? r1(weighted / weightSum) : null,
        slaPct, patPassPct, returnRatePct, perTeamDay, components,
        lowVolume: m.completed < MIN_ORDERS_FOR_RANKING,
    };
}

export interface ContractorMonthRow extends ContractorMonthMetrics, ContractorScore {
    month: string;
}

export interface ContractorScorecardRow {
    contractorId: string;
    name: string;
    current: ContractorMonthRow;
    trend: { month: string; score: number | null; completed: number }[];
    /** Change in score against the previous month; null when either month has no score. */
    change: number | null;
}

export interface ContractorScorecardReport {
    month: string;
    months: string[];
    rows: ContractorScorecardRow[];
    /** Completed orders in the month that have no contractor recorded: outside any scorecard. */
    unassignedCompleted: number;
    totalCompleted: number;
    notes: string[];
}

/** Last `count` calendar months ending at `month` (YYYY-MM), oldest first. */
export function monthRange(month: string, count: number): string[] {
    const [y, m] = month.split('-').map(Number);
    return Array.from({ length: count }, (_, i) => {
        const d = new Date(Date.UTC(y, m - 1 - (count - 1 - i), 1));
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    });
}
