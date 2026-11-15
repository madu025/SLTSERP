// Pure rules for the monthly Head Office plan and the month-end reconciliation (no database access).

const round2 = (n: number) => Math.round(n * 100) / 100;

/** 'YYYY-MM' -> first and last instant of that month (UTC). */
export function monthRange(month: string): { start: Date; end: Date } | null {
    const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    return { start: new Date(Date.UTC(y, mo - 1, 1)), end: new Date(Date.UTC(y, mo, 0, 23, 59, 59, 999)) };
}

export function currentMonth(now = new Date()): string {
    return now.toISOString().slice(0, 7);
}

/** What is still to be requested for a payable: what is owed less payment requests that are alive (not cancelled, rejected or paid). */
export function unrequestedAmount(outstanding: number, live: number): number {
    return Math.max(0, round2(outstanding - live));
}

export type PlanState = 'NOT_REQUESTED' | 'REQUESTED' | 'WITH_HEAD_OFFICE';
export function planState(outstanding: number, live: number, withHo: number): PlanState {
    if (withHo > 0 && unrequestedAmount(outstanding, live) === 0) return 'WITH_HEAD_OFFICE';
    return live > 0 ? 'REQUESTED' : 'NOT_REQUESTED';
}

/** The ledger balance (credit less debit of the Head Office account) against what Head Office says it is. */
export function reconciliationDifference(ledgerBalance: number, hoBalance: number): number {
    return round2(ledgerBalance - hoBalance);
}

export function reconciliationStatus(difference: number): 'RECONCILED' | 'DIFFERENCE' {
    return Math.abs(difference) < 0.005 ? 'RECONCILED' : 'DIFFERENCE';
}

/** A month with a difference needs an explanation; a reconciled month is final. */
export function reconciliationBlocker(existingStatus: string | null, difference: number, note: string | null | undefined): string | null {
    if (existingStatus === 'RECONCILED') return 'MONTH_ALREADY_RECONCILED';
    if (Math.abs(difference) >= 0.005 && !(note ?? '').trim()) return 'NOTE_REQUIRED_WHEN_THERE_IS_A_DIFFERENCE';
    return null;
}
