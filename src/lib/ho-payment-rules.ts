// Pure rules for the Head Office payment model (no database access).

/** A pack's status follows its vouchers: all paid, some paid, all sent back, otherwise still with Head Office. */
export function batchStatus(voucherStatuses: string[]): 'SUBMITTED' | 'PARTIALLY_PAID' | 'PAID' | 'RETURNED' {
    const total = voucherStatuses.length;
    if (total === 0) return 'SUBMITTED';
    const paid = voucherStatuses.filter((s) => s === 'PAID').length;
    if (paid === total) return 'PAID';
    if (paid > 0) return 'PARTIALLY_PAID';
    const waiting = voucherStatuses.filter((s) => s === 'SUBMITTED_TO_HO').length;
    return waiting === 0 ? 'RETURNED' : 'SUBMITTED';
}

export const FUNDING_PURPOSES = ['PAYMENTS', 'PETTY_CASH_FLOAT', 'PETTY_CASH_REPLENISH'] as const;
export type FundingPurpose = typeof FUNDING_PURPOSES[number];

const FUNDING_TRANSITIONS: Record<string, string[]> = {
    DRAFT: ['SUBMITTED', 'CANCELLED'],
    SUBMITTED: ['APPROVED', 'REJECTED', 'CANCELLED'],
    APPROVED: ['FUNDED', 'CANCELLED'],
    FUNDED: [], REJECTED: [], CANCELLED: [],
};
export function canTransitionFunding(from: string, to: string): boolean {
    return (FUNDING_TRANSITIONS[from] ?? []).includes(to);
}

/** Head Office may approve less than asked, never more; a petty-cash replenishment is all or nothing (it clears a fixed set of vouchers). */
export function validApprovedAmount(purpose: string, requested: number, approved: number): boolean {
    if (!(approved > 0) || approved > requested + 0.005) return false;
    return purpose !== 'PETTY_CASH_REPLENISH' || Math.abs(approved - requested) < 0.005;
}

/** Funded money never exceeds what was approved. */
export function validFundedAmount(approved: number, funded: number): boolean {
    return funded > 0 && funded <= approved + 0.005;
}

export interface HoPosition { requested: number; approved: number; funded: number; submittedUnpaid: number; confirmedPaid: number }
/** What is still to come from Head Office against approved funding: approved less funded money and less payments Head Office has already made. */
export function remainingAllocation(p: Pick<HoPosition, 'approved' | 'funded' | 'confirmedPaid'>): number {
    return Math.round((p.approved - p.funded - p.confirmedPaid) * 100) / 100;
}
