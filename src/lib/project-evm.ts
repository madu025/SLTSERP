/**
 * Earned-value maths for a project, derived from the plan and the work done, never typed in.
 *
 *   planned % (PV basis)  - how much of the work SHOULD be finished by now: an s-curve over the task plan,
 *                           weighted by task cost (falling back to duration, then to a straight line over the project dates)
 *   earned value (EV)     - budget at completion x actual progress %
 *   actual cost (AC)      - from the cost ledger; null while unknown (never treated as zero cost)
 *
 * Pure functions only, so the rules are unit-tested exactly.
 */

export interface EvmTask {
    plannedStart: Date | null;
    plannedEnd: Date | null;
    estimatedCost: number | null;
    plannedDurationDays: number | null;
}

export interface EvmProjectDates {
    startDate: Date | null;
    endDate: Date | null;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const r2 = (v: number) => Math.round(v * 100) / 100;
const r4 = (v: number) => Math.round(v * 10000) / 10000;

/** Fraction (0..1) of a dated window elapsed at `now`. A zero-length window is done once its date has passed. */
export function elapsedFraction(start: Date, end: Date, now: Date): number {
    const total = end.getTime() - start.getTime();
    if (total <= 0) return now.getTime() >= end.getTime() ? 1 : 0;
    return clamp01((now.getTime() - start.getTime()) / total);
}

/**
 * Planned percent complete (0..100) at `now`, or null when there is no schedule to measure against.
 * Task weights are all in the same unit: cost if any task has a cost, otherwise duration, otherwise equal.
 */
export function plannedPercent(tasks: EvmTask[], project: EvmProjectDates, now: Date): number | null {
    const dated = tasks.filter((t) => t.plannedStart && t.plannedEnd);
    if (dated.length > 0) {
        const hasCost = dated.some((t) => (t.estimatedCost ?? 0) > 0);
        const hasDuration = dated.some((t) => (t.plannedDurationDays ?? 0) > 0);
        const weightOf = (t: EvmTask) => (hasCost ? (t.estimatedCost ?? 0) : hasDuration ? (t.plannedDurationDays ?? 0) : 1);
        const totalWeight = dated.reduce((a, t) => a + weightOf(t), 0);
        if (totalWeight > 0) {
            const done = dated.reduce((a, t) => a + weightOf(t) * elapsedFraction(t.plannedStart!, t.plannedEnd!, now), 0);
            return r2((done / totalWeight) * 100);
        }
    }
    if (project.startDate && project.endDate) return r2(elapsedFraction(project.startDate, project.endDate, now) * 100);
    return null;
}

export type EvmStatus = 'GREEN' | 'AMBER' | 'RED';

export interface EvmResult {
    bac: number;
    plannedPct: number | null;
    progressPct: number;
    pv: number | null;
    ev: number;
    ac: number | null;
    spi: number | null;
    cpi: number | null;
    sv: number | null;
    cv: number | null;
    /** Estimate at completion = BAC / CPI; falls back to BAC while cost efficiency is unknown. */
    eac: number | null;
    etc: number | null;
    vac: number | null;
    status: EvmStatus;
    /** Why a figure is missing, so a screen can say so instead of showing a made-up number. */
    gaps: string[];
}

export function computeEvm(input: { bac: number; progressPct: number; plannedPct: number | null; actualCost: number | null }): EvmResult {
    const bac = Math.max(0, input.bac);
    const progressPct = Math.min(100, Math.max(0, input.progressPct));
    const gaps: string[] = [];

    const ev = r2((bac * progressPct) / 100);
    const pv = input.plannedPct === null ? null : r2((bac * input.plannedPct) / 100);
    if (pv === null) gaps.push('No schedule (task dates or project start/end): planned value and SPI cannot be measured');
    if (bac <= 0) gaps.push('No budget set: earned value and cost metrics are zero');

    const ac = input.actualCost;
    if (ac === null) gaps.push('Actual cost is still pending (material cost unknown), so CPI is not calculated');

    const spi = pv !== null && pv > 0 ? r4(ev / pv) : null;
    const cpi = ac !== null && ac > 0 ? r4(ev / ac) : null;
    // BAC / CPI, taken from the unrounded ratio (BAC x AC / EV) so rounding the index cannot move the estimate
    const eac = bac <= 0 ? null : ac !== null && ac > 0 && ev > 0 ? r2((bac * ac) / ev) : bac;
    const etc = eac !== null && ac !== null ? r2(Math.max(0, eac - ac)) : null;

    const worst = Math.min(spi ?? 1, cpi ?? 1);
    const status: EvmStatus = worst < 0.8 ? 'RED' : worst < 0.95 ? 'AMBER' : 'GREEN';

    return {
        bac, plannedPct: input.plannedPct, progressPct, pv, ev, ac, spi, cpi,
        sv: pv === null ? null : r2(ev - pv),
        cv: ac === null ? null : r2(ev - ac),
        eac, etc,
        vac: eac === null ? null : r2(bac - eac),
        status, gaps,
    };
}

/** Alert threshold shared by the daily project alerts and the dashboard. */
export const SPI_ALERT_THRESHOLD = 0.85;
