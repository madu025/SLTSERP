/** Client-safe rules and types for the supply-chain reports (procurement, vendors, inventory health). */

export const DAY_MS = 24 * 3600 * 1000;

/** Days past the expected delivery date; null when there is no date or it is not yet due. */
export function lateDays(expected: Date | string | null | undefined, now: Date): number | null {
    if (!expected) return null;
    const d = Math.floor((now.getTime() - new Date(expected).getTime()) / DAY_MS);
    return d >= 1 ? d : null;
}

export const LATE_BUCKETS = ['1-7', '8-14', '15-30', '30+'] as const;
export type LateBucket = (typeof LATE_BUCKETS)[number];

export function lateBucket(days: number): LateBucket {
    if (days <= 7) return '1-7';
    if (days <= 14) return '8-14';
    if (days <= 30) return '15-30';
    return '30+';
}

/** Share of the ordered quantity that has been accepted, capped at 100; null when nothing was ordered. */
export function fulfilmentPct(accepted: number, ordered: number): number | null {
    if (!(ordered > 0)) return null;
    return Number(Math.min(100, (Math.max(0, accepted) / ordered) * 100).toFixed(1));
}

export const MIN_ORDERS_FOR_VENDOR_RANKING = 3;

/** Vendor score weights: documented on the vendors page; they add up to 100. */
export const VENDOR_SCORE_WEIGHTS = { onTime: 40, quality: 30, price: 20, leadTime: 10 } as const;
export const TARGET_LEAD_DAYS = 14;

export interface VendorScoreInput {
    onTimePct: number | null;      // receipts on or before the expected date
    rejectPct: number | null;      // rejected / received
    priceVariancePct: number | null; // PO price vs quoted price, positive = paid more
    avgLeadDays: number | null;    // order to receipt
}

/** Weighted 0-100 score; criteria without data are left out and the rest re-weighted, so thin data never reads as a zero. */
export function vendorScore(i: VendorScoreInput): number | null {
    const parts: { weight: number; value: number }[] = [];
    if (i.onTimePct !== null) parts.push({ weight: VENDOR_SCORE_WEIGHTS.onTime, value: clamp(i.onTimePct) });
    if (i.rejectPct !== null) parts.push({ weight: VENDOR_SCORE_WEIGHTS.quality, value: clamp(100 - i.rejectPct * 5) }); // 20% rejects = 0
    if (i.priceVariancePct !== null) parts.push({ weight: VENDOR_SCORE_WEIGHTS.price, value: clamp(100 - Math.max(0, i.priceVariancePct) * 5) }); // 20% over quote = 0
    if (i.avgLeadDays !== null) parts.push({ weight: VENDOR_SCORE_WEIGHTS.leadTime, value: clamp(100 - Math.max(0, i.avgLeadDays - TARGET_LEAD_DAYS) * 5) });
    const total = parts.reduce((a, p) => a + p.weight, 0);
    if (total === 0) return null;
    return Math.round(parts.reduce((a, p) => a + p.value * p.weight, 0) / total);
}

function clamp(v: number) { return Math.max(0, Math.min(100, v)); }

export const DEAD_STOCK_BUCKETS = ['30-90', '90-180', '180+', 'never moved'] as const;
export type DeadStockBucket = (typeof DEAD_STOCK_BUCKETS)[number];

/** Days since the last outbound movement; null = never moved. Stock moved in the last 30 days is active (null result). */
export function deadStockBucket(daysSinceMove: number | null): DeadStockBucket | null {
    if (daysSinceMove === null) return 'never moved';
    if (daysSinceMove < 30) return null;
    if (daysSinceMove < 90) return '30-90';
    if (daysSinceMove < 180) return '90-180';
    return '180+';
}

/** Quantity to order to bring available stock back to twice the reorder level (a suggestion, never an automatic order). */
export function suggestedOrderQty(available: number, min: number): number {
    return Math.max(0, Math.ceil(2 * min - available));
}

/** Days of cover at the recent consumption rate; null when nothing was consumed. */
export function daysOfCover(stockValue: number, outflowValueWindow: number, windowDays: number): number | null {
    if (!(outflowValueWindow > 0) || windowDays <= 0) return null;
    return Math.round(stockValue / (outflowValueWindow / windowDays));
}

/** Request-to-receipt stages, in order, with the column each one is stamped in. */
export const REQUEST_STAGES = [
    { key: 'REQUEST', label: 'Awaiting ARM' },
    { key: 'ARM', label: 'Awaiting stores manager' },
    { key: 'STORES_MANAGER', label: 'Awaiting HS/OSP' },
    { key: 'HS_OSP', label: 'Awaiting manager' },
    { key: 'MANAGER', label: 'Awaiting release' },
] as const;

/** Human label of what a request is waiting for; null when it is not waiting on an approval stage. */
export function waitingFor(armDate: unknown, storesManagerDate: unknown, hsOspDate: unknown, managerDate: unknown, releasedDate: unknown): string | null {
    if (releasedDate) return null;
    if (!armDate) return REQUEST_STAGES[0].label;
    if (!storesManagerDate) return REQUEST_STAGES[1].label;
    if (!hsOspDate) return REQUEST_STAGES[2].label;
    if (!managerDate) return REQUEST_STAGES[3].label;
    return REQUEST_STAGES[4].label;
}

// ---- report shapes shared by the services and the pages -------------------------------------------------------

export interface LatePo {
    id: string;
    poNumber: string;
    vendor: string;
    system: 'STORE' | 'PROJECT';
    expectedDelivery: string | null;
    daysLate: number | null;
    bucket: LateBucket | null;
    amount: number | null;
    href: string;
}

export interface ProcurementReport {
    asOf: string;
    store: {
        openPos: number;
        late: number;
        noDeliveryDate: number;
        lateBuckets: { bucket: string; count: number }[];
        waiting: { label: string; count: number; oldestDays: number | null }[];
        leadTime: { avgDays: number | null; medianDays: number | null; p90Days: number | null; completed: number };
        leadTimeMonthly: { label: string; avgDays: number | null; completed: number }[];
        sourceMix: { source: string; count: number }[];
    };
    project: {
        funnel: { status: string; count: number; amount: number }[];
        late: number;
        pendingApproval: { count: number; oldestDays: number | null };
        fulfilmentPct: number | null;
    };
    latePos: LatePo[];
    /** Receipts bought at a price different from the previous purchase of the same item, largest difference first (last 90 days). */
    priceVariance: { code: string; item: string; price: number; previous: number; variancePct: number; grn: string; supplier: string | null; at: string }[];
}

export interface VendorRow {
    vendorId: string;
    name: string;
    orders: number;
    spend: number;
    onTimePct: number | null;
    rejectPct: number | null;
    priceVariancePct: number | null;
    avgLeadDays: number | null;
    score: number | null;
    lowVolume: boolean;
}

export interface VendorScorecard {
    asOf: string;
    months: number;
    rows: VendorRow[];
    /** Store-system vendors are free text; they are grouped by a cleaned-up name and cannot be scored. */
    unlinked: { name: string; pos: number }[];
    totalSpend: number;
}

export interface InventoryHealth {
    asOf: string;
    showValues: boolean;
    stores: { storeId: string; name: string; skus: number; value: number | null; belowReorder: number; stockOut: number; lastCountDays: number | null }[];
    totals: { value: number | null; skus: number; belowReorder: number; stockOut: number; overAllocated: number; deadValue: number | null; deadSkus: number };
    reorder: { storeId: string; store: string; code: string; name: string; available: number; min: number; stockOut: boolean; suggestedQty: number }[];
    dead: { bucket: DeadStockBucket; skus: number; value: number | null }[];
    deadTop: { store: string; code: string; name: string; quantity: number; value: number | null; daysSinceMove: number | null }[];
    turnover: { code: string; name: string; value: number | null; outflow90: number | null; coverDays: number | null }[];
    expiring: { batch: string; item: string; expiry: string; daysLeft: number; quantity: number }[];
    neverCountedStores: number;
    notes: string[];
}
