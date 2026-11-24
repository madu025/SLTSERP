// Pure rules for the OSP floats (petty cash / project advance) and the settlement of the IOUs issued against them. No database access.

export const FLOAT_TYPES = ['PETTY_CASH', 'PROJECT_ADVANCE', 'FUEL', 'OTHER'] as const;
export type FloatType = typeof FLOAT_TYPES[number];

/** BILLS: the person spent it and handed the bills in. REFUND: unspent cash returned. REMINDER: a follow-up note, no money. */
export const SETTLEMENT_KINDS = ['BILLS', 'REFUND', 'REMINDER'] as const;
export type SettlementKind = typeof SETTLEMENT_KINDS[number];

export type SettlementStatus = 'OPEN' | 'PARTIALLY_SETTLED' | 'SETTLED';

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface SettlementLike { kind: string; amount: number }

/** What is still to be settled on an IOU: the amount issued less the bills handed in and the cash returned. Reminders carry no money. */
export function iouOutstanding(issued: number, settlements: SettlementLike[]): number {
    const settled = settlements.filter((s) => s.kind === 'BILLS' || s.kind === 'REFUND').reduce((a, s) => a + s.amount, 0);
    return round2(Math.max(0, issued - settled));
}

export function settlementStatus(issued: number, outstanding: number): SettlementStatus {
    if (outstanding <= 0.005) return 'SETTLED';
    return outstanding < issued - 0.005 ? 'PARTIALLY_SETTLED' : 'OPEN';
}

/** Whole days since the IOU was issued (never negative). */
export function daysOutstanding(issuedDate: Date | null | undefined, now: Date = new Date()): number {
    if (!issuedDate) return 0;
    return Math.max(0, Math.floor((now.getTime() - issuedDate.getTime()) / 86400000));
}

/** Cash still available in a float: the limit less what is out on approved, unsettled IOUs. It can be negative when the limit was lowered after issue. */
export function floatAvailable(limit: number, outstandingOnApprovedIous: number): number {
    return round2(limit - outstandingOnApprovedIous);
}

export interface IssueCheckInput {
    floatLimit: number;
    /** outstanding on the other approved IOUs of this float */
    outstandingOthers: number;
    amount: number;
    /** the same person's other approved IOUs that are not settled */
    staffOpenIous: Array<{ outstanding: number; days: number }>;
    /** the float's own limit of days an IOU may stay open before a new one is refused (0 = no limit) */
    maxDaysOutstanding: number;
}
export type IssueCheck = { ok: true } | { ok: false; reason: 'FLOAT_EXCEEDED' | 'STAFF_HAS_OVERDUE_IOU' | 'INVALID_AMOUNT'; message: string };

/** Whether an IOU may be issued (approved) against a float. */
export function checkIssue(i: IssueCheckInput): IssueCheck {
    if (!(i.amount > 0)) return { ok: false, reason: 'INVALID_AMOUNT', message: 'The amount must be more than zero' };
    const available = floatAvailable(i.floatLimit, i.outstandingOthers);
    if (i.amount > available + 0.005) {
        return { ok: false, reason: 'FLOAT_EXCEEDED', message: `The float has Rs. ${available.toFixed(2)} available; this IOU is Rs. ${i.amount.toFixed(2)}` };
    }
    if (i.maxDaysOutstanding > 0) {
        const overdue = i.staffOpenIous.find((o) => o.outstanding > 0.005 && o.days > i.maxDaysOutstanding);
        if (overdue) return { ok: false, reason: 'STAFF_HAS_OVERDUE_IOU', message: `This person has an IOU open for ${overdue.days} days (limit ${i.maxDaysOutstanding}); settle it first` };
    }
    return { ok: true };
}

export type SettlementCheck = { ok: true } | { ok: false; reason: string; message: string };

/** Whether a settlement row may be added to an IOU. */
export function checkSettlement(input: { kind: string; amount: number; outstanding: number; iouStatus: string }): SettlementCheck {
    if (!(SETTLEMENT_KINDS as readonly string[]).includes(input.kind)) return { ok: false, reason: 'INVALID_KIND', message: 'The settlement kind is not valid' };
    if (input.iouStatus !== 'APPROVED') return { ok: false, reason: 'IOU_NOT_ISSUED', message: 'Only an approved (issued) IOU can be settled' };
    if (input.kind === 'REMINDER') return input.amount === 0 ? { ok: true } : { ok: false, reason: 'REMINDER_HAS_NO_MONEY', message: 'A reminder carries no amount' };
    if (!(input.amount > 0)) return { ok: false, reason: 'INVALID_AMOUNT', message: 'The amount must be more than zero' };
    if (input.outstanding <= 0.005) return { ok: false, reason: 'ALREADY_SETTLED', message: 'The IOU is already settled' };
    if (input.amount > input.outstanding + 0.005) return { ok: false, reason: 'EXCEEDS_OUTSTANDING', message: `Only Rs. ${input.outstanding.toFixed(2)} is outstanding on this IOU` };
    return { ok: true };
}

/** The GL side of a settlement: bills become an expense, a refund returns the cash. Both clear the advance. */
export function settlementPosting(kind: 'BILLS' | 'REFUND', floatType: string): { debit: 'EXPENSE_PETTY' | 'EXPENSE_OSP' | 'BANK'; credit: 'ADVANCES' } {
    if (kind === 'REFUND') return { debit: 'BANK', credit: 'ADVANCES' };
    return { debit: floatType === 'PETTY_CASH' ? 'EXPENSE_PETTY' : 'EXPENSE_OSP', credit: 'ADVANCES' };
}
