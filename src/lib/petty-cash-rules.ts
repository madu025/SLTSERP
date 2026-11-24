// Pure rules for the petty cash box of a site office. No database access.
//
// The box (PettyCashAccount) holds the cash. Its balance is the cash in hand: IOUs drawn from it and approved bills have already left it.
// Cash the site office has put out, in one of three forms: cash on an open IOU, bills approved but not yet reimbursed, cash in the box.
// The imprest is whole when  cash in hand + cash on IOUs + bills not reimbursed = the imprest limit.

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface BoxFigures { limit: number; balance: number; iouOut: number; billsWaiting: number }
export interface BoxSummary extends BoxFigures {
    cashInHand: number;
    /** what the next replenishment claim asks of Head Office: the bills waiting */
    replenishAmount: number;
    /** limit less everything accounted for; not zero means the imprest does not add up (a gap to explain) */
    unaccounted: number;
}

export function boxSummary(f: BoxFigures): BoxSummary {
    return {
        ...f,
        cashInHand: round2(f.balance),
        replenishAmount: round2(f.billsWaiting),
        unaccounted: round2(f.limit - f.balance - f.iouOut - f.billsWaiting),
    };
}

export type DrawCheck = { ok: true } | { ok: false; reason: 'INSUFFICIENT_PETTY_CASH_BALANCE' | 'INVALID_AMOUNT'; message: string };

/** Cash drawn from the box (an IOU issued) must be there. */
export function checkDraw(balance: number, amount: number): DrawCheck {
    if (!(amount > 0)) return { ok: false, reason: 'INVALID_AMOUNT', message: 'The amount must be more than zero' };
    if (amount > balance + 0.005) return { ok: false, reason: 'INSUFFICIENT_PETTY_CASH_BALANCE', message: `The box has Rs. ${balance.toFixed(2)} in hand; this needs Rs. ${amount.toFixed(2)}` };
    return { ok: true };
}

/** A new account starts with what is really in the box (0 when Head Office will fund the float), never more than the limit. */
export function checkOpening(limit: number, opening: number): { ok: true } | { ok: false; message: string } {
    if (!(limit > 0)) return { ok: false, message: 'The imprest limit must be more than zero' };
    if (!(opening >= 0)) return { ok: false, message: 'The opening balance cannot be negative' };
    if (opening > limit + 0.005) return { ok: false, message: 'The opening balance cannot be more than the imprest limit' };
    return { ok: true };
}

/** Only a bill that is still a draft can be cancelled: after the approval the expense is in the books. */
export function canCancelVoucher(status: string): boolean {
    return status === 'DRAFT';
}

/** A refund returns cash to the box; the box never holds more than its limit. */
export function checkRefundIntoBox(limit: number, balance: number, amount: number): DrawCheck {
    if (!(amount > 0)) return { ok: false, reason: 'INVALID_AMOUNT', message: 'The amount must be more than zero' };
    if (balance + amount > limit + 0.005) return { ok: false, reason: 'INSUFFICIENT_PETTY_CASH_BALANCE', message: `The box would hold Rs. ${(balance + amount).toFixed(2)}, more than its limit of Rs. ${limit.toFixed(2)}` };
    return { ok: true };
}
