/** Client-safe types and the health rule for the RTOM scoreboard. */

export interface ScoreboardRow {
    rtom: string;
    region: string | null;
    open: number;
    over14: number;
    agedPct: number | null;
    completed: number;
    slaPct: number | null;
    medianDays: number | null;
    returned: number;
    returnRatePct: number | null;
    daysToClear: number | null;
    activeProjects: number;
    delayedProjects: number;
    /** 0..100 average of the components that have data; null when nothing can be measured. */
    health: number | null;
}

export interface OpsScoreboard {
    windowDays: number;
    slaDays: number;
    rows: ScoreboardRow[];
    totals: { open: number; over14: number; completed: number; slaPct: number | null; returned: number; activeProjects: number; delayedProjects: number };
    notes: string[];
}

const clamp = (v: number) => Math.min(100, Math.max(0, v));
const r1 = (v: number) => Math.round(v * 10) / 10;

/**
 * One comparable number per RTOM: the average of SLA compliance, "backlog not aged" (100 minus the share open longer
 * than 14 days) and "returns under control" (100 minus 5x the return rate). Components without data are left out.
 */
export function healthScore(slaPct: number | null, agedPct: number | null, returnRatePct: number | null): number | null {
    const parts: number[] = [];
    if (slaPct !== null) parts.push(clamp(slaPct));
    if (agedPct !== null) parts.push(clamp(100 - agedPct));
    if (returnRatePct !== null) parts.push(clamp(100 - returnRatePct * 5));
    return parts.length ? r1(parts.reduce((a, b) => a + b, 0) / parts.length) : null;
}
