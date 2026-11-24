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

/**
 * The GL side of a settlement: bills become an expense, a refund returns the cash. Both clear the advance.
 * An IOU drawn from a petty cash box returns its cash to the box (the petty cash account), not to the bank.
 */
export function settlementPosting(kind: 'BILLS' | 'REFUND', floatType: string, fromBox = false): { debit: 'EXPENSE_PETTY' | 'EXPENSE_OSP' | 'BANK' | 'PETTY_CASH'; credit: 'ADVANCES' } {
    if (kind === 'REFUND') return { debit: fromBox ? 'PETTY_CASH' : 'BANK', credit: 'ADVANCES' };
    return { debit: floatType === 'PETTY_CASH' ? 'EXPENSE_PETTY' : 'EXPENSE_OSP', credit: 'ADVANCES' };
}

export type SubmissionCheck = { ok: true } | { ok: false; reason: 'NOTHING_TO_SETTLE' | 'INVALID_AMOUNT' | 'EXCEEDS_OUTSTANDING' | 'ALREADY_WAITING' | 'IOU_NOT_ISSUED'; message: string };

/**
 * The custodian settles an issued IOU with the bills handed in and the cash returned. Together they cannot be more than what is outstanding: if the person
 * spent more than they were given, the extra is a separate bill (approved by the Area Manager), not part of the settlement.
 */
export function checkSettlementSubmission(input: { iouStatus: string; outstanding: number; bills: number; refund: number; hasWaiting: boolean }): SubmissionCheck {
    if (input.iouStatus !== 'APPROVED') return { ok: false, reason: 'IOU_NOT_ISSUED', message: 'Only an issued IOU can be settled' };
    if (!(input.bills >= 0) || !(input.refund >= 0)) return { ok: false, reason: 'INVALID_AMOUNT', message: 'The amounts cannot be negative' };
    if (!(input.bills + input.refund > 0)) return { ok: false, reason: 'NOTHING_TO_SETTLE', message: 'Enter the bills handed in, the cash returned, or both' };
    if (input.hasWaiting) return { ok: false, reason: 'ALREADY_WAITING', message: 'A settlement of this IOU is already waiting for the Area Manager' };
    const total = Math.round((input.bills + input.refund) * 100) / 100;
    if (total > input.outstanding + 0.005) {
        return { ok: false, reason: 'EXCEEDS_OUTSTANDING', message: `Bills and cash returned come to Rs. ${total.toFixed(2)}, but only Rs. ${input.outstanding.toFixed(2)} is outstanding. If more was spent than was given, record the extra as a separate bill` };
    }
    return { ok: true };
}
