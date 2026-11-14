/**
 * Client-safe pieces of the SOD performance report: types and pure helpers.
 * Kept free of server imports so pages can use the value exports (AGE_BUCKETS) without bundling Prisma.
 */

export const AGE_BUCKETS = ['0-3', '3-7', '7-14', '14-30', '30+'] as const;
export type AgeBucket = (typeof AGE_BUCKETS)[number];

export interface TurnaroundRow {
    key: string;
    label: string;
    completed: number;
    avgDays: number | null;
    medianDays: number | null;
    p90Days: number | null;
    withinSla: number;
    slaPct: number | null;
}

export interface AgeingRow {
    key: string;
    label: string;
    open: number;
    buckets: Record<AgeBucket, number>;
    over14: number;
}

export interface CapacityRow {
    key: string;
    label: string;
    open: number;
    completedLast14Days: number;
    perDay: number;
    /** Working-through time at the recent completion rate; null when nothing was completed recently. */
    daysToClear: number | null;
}

export interface TeamProductivityRow {
    teamId: string;
    teamName: string;
    contractorName: string;
    completed: number;
    activeDays: number;
    perActiveDay: number | null;
}

export interface ReasonRow { category: string; count: number; pct: number }

export interface SodPerformanceReport {
    from: string;
    to: string;
    slaDays: number;
    overall: TurnaroundRow;
    turnaroundByRtom: TurnaroundRow[];
    turnaroundByContractor: TurnaroundRow[];
    ageingByRtom: AgeingRow[];
    ageingByContractor: AgeingRow[];
    capacityByRtom: CapacityRow[];
    returnReasons: ReasonRow[];
    returnedOrders: number;
    teamProductivity: TeamProductivityRow[];
    notes: string[];
}

/* ---------- pure helpers (unit-tested) ---------- */

export function ageBucket(days: number): AgeBucket {
    if (days < 3) return '0-3';
    if (days < 7) return '3-7';
    if (days < 14) return '7-14';
    if (days < 30) return '14-30';
    return '30+';
}

export function slaPct(within: number, total: number): number | null {
    return total > 0 ? Number(((within / total) * 100).toFixed(1)) : null;
}

export function daysToClear(open: number, completedLast14Days: number): number | null {
    if (open <= 0) return 0;
    if (completedLast14Days <= 0) return null;
    return Number((open / (completedLast14Days / 14)).toFixed(1));
}

export function emptyBuckets(): Record<AgeBucket, number> {
    return { '0-3': 0, '3-7': 0, '7-14': 0, '14-30': 0, '30+': 0 };
}
