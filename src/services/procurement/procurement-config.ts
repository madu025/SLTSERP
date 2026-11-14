import { prisma } from '@/lib/prisma';
import { DEFAULT_MATCH_PRICE_TOLERANCE_PCT, DEFAULT_OVER_RECEIPT_TOLERANCE_PCT } from '@/lib/procurement-rules';

export type CostingMethod = 'WEIGHTED_AVERAGE' | 'MANUAL';

export interface ProcurementConfig {
    /** Percent of the ordered quantity that may be received beyond the order (0 = blocked). */
    overReceiptTolerancePct: number;
    /** Percent the invoice price may differ from the PO price in the 3-way match. */
    matchPriceTolerancePct: number;
    /** How the item cost price follows receipts. */
    costingMethod: CostingMethod;
}

const num = (v: string | undefined, fallback: number) => {
    const n = Number(v);
    return v !== undefined && v !== '' && Number.isFinite(n) && n >= 0 ? n : fallback;
};

/** Reads the procurement keys from SystemConfig; a missing key or a database hiccup falls back to the documented default. */
export async function getProcurementConfig(client: Pick<typeof prisma, '$queryRaw'> = prisma): Promise<ProcurementConfig> {
    try {
        const rows = await client.$queryRaw<{ key: string; value: string }[]>`
            SELECT "key", "value" FROM "SystemConfig"
            WHERE "key" IN ('PO_OVER_RECEIPT_TOLERANCE_PCT', 'MATCH_PRICE_TOLERANCE_PCT', 'INVENTORY_COSTING_METHOD')`;
        const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
        return {
            overReceiptTolerancePct: num(map.PO_OVER_RECEIPT_TOLERANCE_PCT, DEFAULT_OVER_RECEIPT_TOLERANCE_PCT),
            matchPriceTolerancePct: num(map.MATCH_PRICE_TOLERANCE_PCT, DEFAULT_MATCH_PRICE_TOLERANCE_PCT),
            costingMethod: map.INVENTORY_COSTING_METHOD === 'MANUAL' ? 'MANUAL' : 'WEIGHTED_AVERAGE',
        };
    } catch {
        return { overReceiptTolerancePct: DEFAULT_OVER_RECEIPT_TOLERANCE_PCT, matchPriceTolerancePct: DEFAULT_MATCH_PRICE_TOLERANCE_PCT, costingMethod: 'WEIGHTED_AVERAGE' };
    }
}
