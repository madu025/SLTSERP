/**
 * Credit purchases through HO: the credit terms of a purchase order and the due date of each delivery's invoice.
 * Pure and client-safe, so the service, the screens and the tests use the same rules.
 *
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

/** Aging bucket of an amount by days past its due date (not yet due counts as current). */
export function dueBucket(days: number | null): 'current' | 'days31to60' | 'days61to90' | 'over90' {
    if (days === null || days <= 30) return 'current';
    if (days <= 60) return 'days31to60';
    if (days <= 90) return 'days61to90';
    return 'over90';
}
