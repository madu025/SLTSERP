// Pure rules for Head Office collection of client (SLT) invoices (no database access).

export const HO_COLLECTION_STATUSES = ['NOT_SENT', 'SENT_TO_HO', 'PARTIALLY_COLLECTED', 'COLLECTED', 'RETURNED'] as const;
export type HoCollectionStatus = typeof HO_COLLECTION_STATUSES[number];

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface SendableInvoice { type: string; status: string; submissionStatus: string; balanceAmount: number; hoCollectionStatus: string; hoBillingBatchId: string | null }

/** Only an unpaid client invoice that has already gone to SLT, and is not already with Head Office, can be sent. */
export function sendBlocker(i: SendableInvoice): string | null {
    if (i.type !== 'CLIENT') return 'ONLY_CLIENT_INVOICES_CAN_BE_SENT_TO_HEAD_OFFICE';
    if (i.submissionStatus !== 'SUBMITTED_TO_SLT') return 'INVOICE_MUST_BE_SUBMITTED_TO_SLT_FIRST';
    if (!(i.balanceAmount > 0)) return 'INVOICE_HAS_NO_BALANCE_TO_COLLECT';
    if (i.hoBillingBatchId && ['SENT_TO_HO', 'PARTIALLY_COLLECTED'].includes(i.hoCollectionStatus)) return 'INVOICE_IS_ALREADY_WITH_HEAD_OFFICE';
    if (i.hoCollectionStatus === 'COLLECTED') return 'INVOICE_IS_ALREADY_COLLECTED';
    return null;
}

/** Head Office collects the whole balance or part of it, never more than SLT still owes. */
export function validCollectionAmount(balance: number, amount: number): boolean {
    return Number.isFinite(amount) && amount > 0 && amount <= balance + 0.005 && Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-6;
}

export function collectionStatusAfter(total: number, paidAfter: number): 'PARTIALLY_COLLECTED' | 'COLLECTED' {
    return round2(total - paidAfter) <= 0 ? 'COLLECTED' : 'PARTIALLY_COLLECTED';
}

/** The sender cannot be the one who confirms Head Office's collection (same separation as payment vouchers). */
export function senderCannotConfirm(sentById: string | null, confirmerId: string): boolean {
    return !!sentById && sentById === confirmerId;
}

/** A pack's status follows its invoices. */
export function billingBatchStatus(statuses: string[]): 'SENT' | 'PARTIALLY_COLLECTED' | 'COLLECTED' | 'RETURNED' {
    const total = statuses.length;
    if (total === 0) return 'SENT';
    const done = statuses.filter((s) => s === 'COLLECTED').length;
    if (done === total) return 'COLLECTED';
    if (done > 0 || statuses.includes('PARTIALLY_COLLECTED')) return 'PARTIALLY_COLLECTED';
    return statuses.includes('SENT_TO_HO') ? 'SENT' : 'RETURNED';
}

export interface ProjectPositionInput {
    billed: number; sentToHo: number; collected: number;
    voucherRequested: number; voucherWithHo: number; voucherPaid: number;
}
/** What Head Office holds for the project (collected from SLT) less what it paid out for it; positive = Head Office owes OSP. */
export function projectNetWithHo(p: Pick<ProjectPositionInput, 'collected' | 'voucherPaid'>): number {
    return round2(p.collected - p.voucherPaid);
}
