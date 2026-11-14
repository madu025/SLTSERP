import { prisma } from '@/lib/prisma';
import { StoreService } from '@/services/inventory/store.service';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { MIN_ORDERS_FOR_VENDOR_RANKING, vendorScore, type VendorScorecard, type VendorRow } from '@/lib/supply-chain-shared';

const RECEIVED_STATUSES = ['APPROVED', 'ISSUED', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'CLOSED'];

/**
 * Vendor scorecard from the project procurement system (the one that links POs to a Vendor record).
 *
 * Spend counts every PO that has been approved or beyond (including issued and closed). On-time compares each
 * non-rejected goods receipt with the PO's expected delivery date; rejects are rejected / received units. Price
 * variance is not scored: POs carry no link to the quotation they were raised from, so there is nothing honest to compare.
 * Store-system POs only hold a free-text vendor name, so those are listed separately and not scored.
 */
export class VendorScorecardService {
    static async getScorecard(userId: string | null, months = 12, now = new Date()): Promise<VendorScorecard> {
        const windowMonths = Math.min(36, Math.max(1, months));
        const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - windowMonths + 1, 1));
        const scope = userId === null ? undefined : await resolveOpmcScope(userId);
        const scopeArr = scope === undefined ? null : scope;
        const storeIds = userId === null ? null : (await StoreService.getAccessibleStores(userId)).map((s) => s.id);

        const [orders, receipts] = await Promise.all([
            prisma.$queryRawUnsafe<{ vendorId: string; name: string; orders: bigint | number; spend: unknown }[]>(
                `SELECT po."vendorId"::text AS "vendorId", max(COALESCE(v."name", po."vendorName")) AS name, count(*) AS orders, sum(po."totalAmount") AS spend
                 FROM "ProjectPurchaseOrder" po JOIN "Project" p ON p."id" = po."projectId" LEFT JOIN "Vendor" v ON v."id" = po."vendorId"
                 WHERE po."status" = ANY($2::text[]) AND po."orderDate" >= $3::timestamptz AND ($1::uuid[] IS NULL OR p."opmcId" = ANY($1::uuid[]))
                 GROUP BY 1`,
                scopeArr, RECEIVED_STATUSES, since,
            ),
            prisma.$queryRawUnsafe<{ vendorId: string; receipts: bigint | number; dated: bigint | number; onTime: bigint | number; received: unknown; rejected: unknown; lead: unknown }[]>(
                `SELECT po."vendorId"::text AS "vendorId", count(DISTINCT gr."id") AS receipts,
                        count(DISTINCT gr."id") FILTER (WHERE po."expectedDelivery" IS NOT NULL) AS dated,
                        count(DISTINCT gr."id") FILTER (WHERE po."expectedDelivery" IS NOT NULL AND gr."receivedDate" <= po."expectedDelivery" + interval '1 day') AS "onTime",
                        COALESCE(sum(gi."quantityReceived"), 0) AS received, COALESCE(sum(gi."quantityRejected"), 0) AS rejected,
                        avg(EXTRACT(EPOCH FROM (gr."receivedDate" - po."orderDate")) / 86400.0) AS lead
                 FROM "ProjectGoodsReceipt" gr JOIN "ProjectPurchaseOrder" po ON po."id" = gr."poId" JOIN "Project" p ON p."id" = po."projectId"
                 LEFT JOIN "ProjectGoodsReceiptItem" gi ON gi."goodsReceiptId" = gr."id"
                 WHERE gr."status" <> 'REJECTED' AND po."orderDate" >= $3::timestamptz AND po."status" = ANY($2::text[]) AND ($1::uuid[] IS NULL OR p."opmcId" = ANY($1::uuid[]))
                 GROUP BY 1`,
                scopeArr, RECEIVED_STATUSES, since,
            ),
        ]);
        const unlinked = await prisma.$queryRawUnsafe<{ name: string; pos: bigint | number }[]>(
            `SELECT lower(btrim(po."vendor")) AS name, count(*) AS pos FROM "PurchaseOrder" po JOIN "StockRequest" r ON r."id" = po."stockRequestId"
             WHERE po."createdAt" >= $2::timestamptz AND ($1::uuid[] IS NULL OR r."fromStoreId" = ANY($1::uuid[]) OR r."toStoreId" = ANY($1::uuid[]))
             GROUP BY 1 ORDER BY 2 DESC LIMIT 15`,
            storeIds, since,
        );

        const rec = new Map(receipts.map((r) => [r.vendorId, r]));
        const round1 = (v: number) => Number(v.toFixed(1));
        const rows: VendorRow[] = orders.map((o) => {
            const r = rec.get(o.vendorId);
            const dated = Number(r?.dated ?? 0);
            const received = Number(r?.received ?? 0);
            const onTimePct = dated > 0 ? round1((Number(r!.onTime) / dated) * 100) : null;
            const rejectPct = received > 0 ? round1((Number(r!.rejected) / received) * 100) : null;
            const avgLeadDays = r && r.lead !== null && r.lead !== undefined ? round1(Number(r.lead)) : null;
            const orderCount = Number(o.orders);
            const lowVolume = orderCount < MIN_ORDERS_FOR_VENDOR_RANKING;
            return {
                vendorId: o.vendorId, name: o.name, orders: orderCount, spend: Number(o.spend ?? 0),
                onTimePct, rejectPct, priceVariancePct: null, avgLeadDays,
                score: lowVolume ? null : vendorScore({ onTimePct, rejectPct, priceVariancePct: null, avgLeadDays }),
                lowVolume,
            };
        }).sort((a, b) => (b.spend - a.spend));

        return {
            asOf: now.toISOString(), months: windowMonths, rows,
            unlinked: unlinked.map((u) => ({ name: u.name || '(blank)', pos: Number(u.pos) })),
            totalSpend: rows.reduce((a, r) => a + r.spend, 0),
        };
    }

    /** Vendors with a ranked score below the line, for the daily alert. */
    static weakVendors(rows: VendorRow[], below = 60, limit = 3): VendorRow[] {
        return rows.filter((r) => r.score !== null && r.score < below).sort((a, b) => (a.score ?? 0) - (b.score ?? 0)).slice(0, limit);
    }
}

