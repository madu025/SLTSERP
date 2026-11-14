/**
 * Pure procurement rules: purchase-order lifecycle, totals, over-receipt, weighted-average cost, price variance and the
 * 3-way match. Client-safe (no database access) so the same rules drive the services, the pages and the tests.
 */

// ---- purchase order lifecycle ---------------------------------------------------------------------------------------

export const PO_STATUSES = ['APPROVED', 'ISSUED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED'] as const;
export type PoStatus = (typeof PO_STATUSES)[number];

const PO_TRANSITIONS: Record<PoStatus, PoStatus[]> = {
    APPROVED: ['ISSUED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'],
    ISSUED: ['PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'],
    PARTIALLY_RECEIVED: ['RECEIVED', 'CLOSED'],
    RECEIVED: ['CLOSED'],
    CLOSED: [],
    CANCELLED: [],
};

/** Legacy rows hold PENDING / COMPLETED; they are read as APPROVED / RECEIVED. */
export function normalizePoStatus(status: string | null | undefined): PoStatus {
    if (status === 'COMPLETED') return 'RECEIVED';
    return (PO_STATUSES as readonly string[]).includes(status ?? '') ? (status as PoStatus) : 'APPROVED';
}

export function canTransitionPo(from: string | null | undefined, to: PoStatus): boolean {
    return PO_TRANSITIONS[normalizePoStatus(from)].includes(to);
}

/** Lines can still be amended or the order cancelled only while nothing has been received. */
export function isPoEditable(status: string | null | undefined, anyReceived: boolean): boolean {
    const s = normalizePoStatus(status);
    return !anyReceived && (s === 'APPROVED' || s === 'ISSUED');
}

/** The status a PO should hold after receipts: nothing received, some, or all lines complete (within tolerance). */
export function poStatusFromReceipts(current: string | null | undefined, lines: { quantity: number; receivedQty: number }[]): PoStatus {
    const status = normalizePoStatus(current);
    if (status === 'CANCELLED' || status === 'CLOSED') return status;
    const any = lines.some((l) => l.receivedQty > 0);
    if (!any) return status === 'ISSUED' ? 'ISSUED' : 'APPROVED';
    const complete = lines.every((l) => l.receivedQty >= l.quantity - 1e-9);
    return complete ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
}

// ---- totals ---------------------------------------------------------------------------------------------------------

export interface PoLineInput { quantity: number; unitPrice: number; taxAmount?: number }

const money = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function validatePoLine(l: PoLineInput): string | null {
    if (!Number.isFinite(l.quantity) || l.quantity <= 0) return 'Quantity must be greater than zero';
    if (!Number.isFinite(l.unitPrice) || l.unitPrice < 0) return 'Unit price cannot be negative';
    if (l.taxAmount !== undefined && (!Number.isFinite(l.taxAmount) || l.taxAmount < 0)) return 'Tax cannot be negative';
    return null;
}

/** Totals are always computed on the server from the lines; a total sent by a client is never trusted. */
export function computePoTotals(lines: PoLineInput[]): { subtotal: number; taxAmount: number; totalAmount: number; lineTotals: number[] } {
    const lineTotals = lines.map((l) => money(l.quantity * l.unitPrice + (l.taxAmount ?? 0)));
    const subtotal = money(lines.reduce((a, l) => a + l.quantity * l.unitPrice, 0));
    const taxAmount = money(lines.reduce((a, l) => a + (l.taxAmount ?? 0), 0));
    return { subtotal, taxAmount, totalAmount: money(subtotal + taxAmount), lineTotals };
}

// ---- receiving ------------------------------------------------------------------------------------------------------

/** How much more of a PO line may be received. Tolerance is a percentage of the ordered quantity (0 = no over-receipt). */
export function overReceiptCheck(ordered: number, receivedSoFar: number, receiving: number, tolerancePct = 0): { ok: boolean; remaining: number; maxAllowed: number } {
    const maxAllowed = ordered * (1 + Math.max(0, tolerancePct) / 100);
    const remaining = Math.max(0, maxAllowed - receivedSoFar);
    return { ok: receiving > 0 && receiving <= remaining + 1e-9, remaining, maxAllowed };
}

// ---- costing --------------------------------------------------------------------------------------------------------

/** Moving weighted-average unit cost after a receipt. With nothing on hand the receipt cost becomes the cost. */
export function weightedAverageCost(onHandQty: number, onHandUnitCost: number, receiptQty: number, receiptUnitCost: number): number {
    if (!(receiptQty > 0)) return onHandUnitCost;
    if (!(onHandQty > 0)) return money(receiptUnitCost);
    return money((onHandQty * onHandUnitCost + receiptQty * receiptUnitCost) / (onHandQty + receiptQty));
}

/** Percentage the paid price is above the reference price (negative = cheaper). Null when there is no reference. */
export function priceVariancePct(price: number, reference: number | null | undefined): number | null {
    if (reference === null || reference === undefined || !(reference > 0)) return null;
    return Number((((price - reference) / reference) * 100).toFixed(2));
}

// ---- 3-way match ----------------------------------------------------------------------------------------------------

export const DEFAULT_MATCH_PRICE_TOLERANCE_PCT = 2;
export const DEFAULT_OVER_RECEIPT_TOLERANCE_PCT = 0;

export type MatchLineResult = 'MATCHED' | 'QTY_OVER_RECEIVED' | 'PRICE_VARIANCE' | 'NOT_RECEIVED';

export interface MatchLine {
    poItemId: string;
    description?: string;
    orderedQty: number;
    orderedPrice: number;
    /** Units accepted on approved receipts */
    receivedQty: number;
    /** Units already billed on other, still-valid invoices */
    invoicedBefore: number;
    invoiceQty: number;
    invoicePrice: number;
}

export interface MatchLineOutcome extends MatchLine {
    result: MatchLineResult;
    /** Billable units still open before this invoice (received - billed) */
    billable: number;
    priceVariancePct: number | null;
}

export interface MatchOutcome {
    status: 'MATCHED' | 'VARIANCE';
    lines: MatchLineOutcome[];
    issues: number;
}

/**
 * Three-way match per line: the invoice may bill at most what was received and not yet billed (quantity tolerance 0),
 * and at the PO price within the price tolerance. A line with nothing received can never match.
 */
export function threeWayMatch(lines: MatchLine[], priceTolerancePct = DEFAULT_MATCH_PRICE_TOLERANCE_PCT): MatchOutcome {
    const out: MatchLineOutcome[] = lines.map((l) => {
        const billable = Math.max(0, l.receivedQty - l.invoicedBefore);
        const variance = priceVariancePct(l.invoicePrice, l.orderedPrice);
        let result: MatchLineResult = 'MATCHED';
        if (l.receivedQty <= 0) result = 'NOT_RECEIVED';
        else if (l.invoiceQty > billable + 1e-9) result = 'QTY_OVER_RECEIVED';
        else if (variance !== null && Math.abs(variance) > priceTolerancePct) result = 'PRICE_VARIANCE';
        return { ...l, result, billable, priceVariancePct: variance };
    });
    const issues = out.filter((l) => l.result !== 'MATCHED').length;
    return { status: issues === 0 ? 'MATCHED' : 'VARIANCE', lines: out, issues };
}
