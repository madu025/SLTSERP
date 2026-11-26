/**
 * Credit purchases through HO: the credit terms of a purchase order, its due date, how a payment by HO is booked, and what is still owed.
 * Pure and client-safe, so the service, the screens and the tests use the same rules.
 *
 * What HO owes the supplier on an order = the goods ordered (at the PO price) + the tax on the order.
 * A verified payment is booked in this order:
 *   1. goods already received and not yet paid  -> clears GR/IR (AP-2010)
 *   2. goods not yet received                   -> an advance (ADV-1210), moved to GR/IR as the goods arrive
 *   3. the tax on the order                     -> input VAT
 * Anything beyond that is more than the order is worth and is refused.
 */

export const PAYMENT_BASES = ['CREDIT', 'ADVANCE', 'ON_DELIVERY'] as const;
export type PaymentBasis = (typeof PAYMENT_BASES)[number];
export const PAYMENT_BASIS_LABEL: Record<PaymentBasis, string> = { CREDIT: 'On credit', ADVANCE: 'Advance (paid before delivery)', ON_DELIVERY: 'On delivery' };
export const PAYMENT_METHODS = ['TRANSFER', 'CHEQUE', 'CASH', 'OTHER'] as const;

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const EPS = 0.005;

export interface CreditTerms { basis?: string | null; creditDays?: number | string | null; dueDate?: string | Date | null }

/** The Procurement Officer must say how the order is paid; on credit, the credit days or the due date from the HO document. */
export function validateCreditTerms(t: CreditTerms | null | undefined): string | null {
    if (!t || !t.basis) return 'Choose how the order is paid: on credit, advance, or on delivery';
    if (!(PAYMENT_BASES as readonly string[]).includes(t.basis)) return 'Unknown payment basis';
    const hasDays = t.creditDays !== null && t.creditDays !== undefined && String(t.creditDays).trim() !== '';
    if (hasDays) {
        const d = Number(t.creditDays);
        if (!Number.isInteger(d) || d < 1 || d > 365) return 'Credit days must be a whole number from 1 to 365';
    }
    if (t.dueDate) {
        const due = new Date(t.dueDate);
        if (Number.isNaN(due.getTime())) return 'The due date is not a valid date';
    }
    if (t.basis === 'CREDIT' && !hasDays && !t.dueDate) return 'On credit: enter the credit days or the due date from the HO document';
    return null;
}

/**
 * When the payment is due: the date typed from the HO document wins; on credit, the first goods receipt plus the credit days;
 * an advance is due when the order is placed; on delivery, when the goods first arrive. Null while it cannot be known yet.
 */
export function dueDateOf(p: { basis?: string | null; creditDays?: number | null; paymentDueDate?: Date | string | null; orderDate?: Date | string | null; firstReceiptAt?: Date | string | null }): Date | null {
    if (p.paymentDueDate) return new Date(p.paymentDueDate);
    if (p.basis === 'ADVANCE' && p.orderDate) return new Date(p.orderDate);
    if (!p.firstReceiptAt) return null;
    const received = new Date(p.firstReceiptAt);
    if (p.basis === 'CREDIT' && p.creditDays) return new Date(received.getTime() + p.creditDays * 86_400_000);
    if (p.basis === 'ON_DELIVERY') return received;
    return null;
}

/** Whole days past the due date (negative while not yet due); null without a due date. */
export function daysOverdue(due: Date | null, today = new Date()): number | null {
    if (!due) return null;
    const day = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    return Math.round((day(today) - day(due)) / 86_400_000);
}

export interface PayableState {
    /** Goods ordered at the PO price (no tax) */
    orderedGoods: number;
    /** Tax on the order */
    tax: number;
    /** Goods received so far at the PO price */
    receivedValue: number;
    /** Received value already paid (GR/IR cleared) */
    cleared: number;
    /** Paid for goods not yet received */
    advance: number;
    /** Tax paid */
    taxPaid: number;
}

export function payableTotal(s: PayableState): number {
    return r2(s.orderedGoods + s.tax);
}

export function paidTotal(s: PayableState): number {
    return r2(s.cleared + s.advance + s.taxPaid);
}

/** What is still owed on the order, ignoring payments that are recorded but not yet verified. */
export function outstanding(s: PayableState): number {
    return Math.max(0, r2(payableTotal(s) - paidTotal(s)));
}

/** What is owed for goods already received (the part that is due once the due date passes). */
export function owedForReceived(s: PayableState): number {
    return Math.max(0, r2(s.receivedValue - s.cleared));
}

export type PaymentSplit = { toGrir: number; toAdvance: number; toTax: number; error?: undefined } | { error: string; toGrir?: undefined; toAdvance?: undefined; toTax?: undefined };

/** How a payment of this amount is booked against the order; an error when it is more than is still owed. */
export function splitPayment(amount: number, s: PayableState): PaymentSplit {
    if (!(amount > 0)) return { error: 'The amount must be greater than zero' };
    let rest = r2(amount);
    const toGrir = Math.min(rest, owedForReceived(s));
    rest = r2(rest - toGrir);
    const goodsRoom = Math.max(0, r2(s.orderedGoods - s.cleared - s.advance - toGrir));
    const toAdvance = Math.min(rest, goodsRoom);
    rest = r2(rest - toAdvance);
    const toTax = Math.min(rest, Math.max(0, r2(s.tax - s.taxPaid)));
    rest = r2(rest - toTax);
    if (rest > EPS) return { error: `The payment is ${r2(rest).toFixed(2)} more than is still owed on the order (${outstanding(s).toFixed(2)})` };
    return { toGrir: r2(toGrir), toAdvance: r2(toAdvance), toTax: r2(toTax) };
}

/** Goods arriving against an order that was paid in advance: this much of the advance becomes payment for received goods. */
export function advanceToApply(advance: number, receiptValue: number): number {
    return Math.max(0, r2(Math.min(advance, receiptValue)));
}

/** A new recorded payment may not take the recorded-or-verified total above what the order is worth. */
export function recordingCapError(amount: number, alreadyRecordedOrVerified: number, payable: number): string | null {
    if (!(amount > 0)) return 'The amount must be greater than zero';
    if (r2(amount + alreadyRecordedOrVerified) > r2(payable) + EPS) return `This payment would take the total paid to ${r2(amount + alreadyRecordedOrVerified).toFixed(2)}, more than the order is worth (${r2(payable).toFixed(2)})`;
    return null;
}

/** Aging bucket of an amount by days past its due date (not yet due counts as current). */
export function dueBucket(days: number | null): 'current' | 'days31to60' | 'days61to90' | 'over90' {
    if (days === null || days <= 30) return 'current';
    if (days <= 60) return 'days31to60';
    if (days <= 90) return 'days61to90';
    return 'over90';
}
