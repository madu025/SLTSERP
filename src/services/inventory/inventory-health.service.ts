import { prisma } from '@/lib/prisma';
import { StoreService } from '@/services/inventory/store.service';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { effectiveInventoryMinLevel, availableInventoryQuantity, inventoryNumber, isInventoryReorderNeeded } from '@/lib/inventory-dashboard-metrics';
import { DAY_MS, DEAD_STOCK_BUCKETS, daysOfCover, deadStockBucket, type InventoryHealth } from '@/lib/supply-chain-shared';

const cache = new Map<string, { at: number; value: Promise<InventoryHealth> }>();
const TTL_MS = 60_000;

/**
 * Inventory health for stores managers and management: value, reorder and stock-out, dead stock, cover and expiry.
 *
 * One valuation everywhere: a row is worth the sum of its batch quantity x batch cost where batches exist, otherwise
 * on-hand quantity x the item's cost price. Reorder follows the shared rule in inventory-dashboard-metrics (store
 * minimum, else item minimum, against available = on hand - allocated). Values are only returned to callers who hold
 * the inventory cost capability.
 */
export class InventoryHealthService {
    /** `userId` null = company-wide (daily job); otherwise limited to the stores that user may access. */
    static async getReport(userId: string | null, showValues: boolean, now = new Date()): Promise<InventoryHealth> {
        const storeIds = userId === null ? null : (await StoreService.getAccessibleStores(userId)).map((s) => s.id);
        if (userId !== null && (await resolveOpmcScope(userId)) !== undefined && storeIds && storeIds.length === 0) {
            return this.empty(now, showValues);
        }
        const key = `${storeIds === null ? 'ALL' : [...storeIds].sort().join(',')}|${showValues}`;
        const hit = cache.get(key);
        if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
        const value = this.compute(storeIds, showValues, now);
        cache.set(key, { at: Date.now(), value });
        value.catch(() => cache.delete(key));
        return value;
    }

    private static empty(now: Date, showValues: boolean): InventoryHealth {
        return {
            asOf: now.toISOString(), showValues, stores: [], reorder: [], dead: DEAD_STOCK_BUCKETS.map((b) => ({ bucket: b, skus: 0, value: showValues ? 0 : null })),
            deadTop: [], turnover: [], expiring: [], neverCountedStores: 0, notes: [],
            totals: { value: showValues ? 0 : null, skus: 0, belowReorder: 0, stockOut: 0, overAllocated: 0, deadValue: showValues ? 0 : null, deadSkus: 0 },
        };
    }

    private static async compute(storeIds: string[] | null, showValues: boolean, now: Date): Promise<InventoryHealth> {
        const storeFilter = storeIds === null ? {} : { storeId: { in: storeIds } };
        const since90 = new Date(now.getTime() - 90 * DAY_MS);

        // Batch 1 (3 concurrent)
        const [stocks, batchValues, lastOut] = await Promise.all([
            prisma.inventoryStock.findMany({
                where: storeFilter,
                select: { storeId: true, itemId: true, quantity: true, allocatedQuantity: true, minLevel: true, store: { select: { name: true } }, item: { select: { code: true, name: true, minLevel: true, costPrice: true } } },
            }),
            prisma.$queryRawUnsafe<{ storeId: string; itemId: string; value: unknown }[]>(
                `SELECT bs."storeId"::text AS "storeId", bs."itemId"::text AS "itemId", sum(bs."quantity" * b."costPrice") AS value
                 FROM "InventoryBatchStock" bs JOIN "InventoryBatch" b ON b."id" = bs."batchId"
                 WHERE bs."quantity" > 0 AND ($1::uuid[] IS NULL OR bs."storeId" = ANY($1::uuid[])) GROUP BY 1, 2`,
                storeIds,
            ),
            prisma.$queryRawUnsafe<{ storeId: string; itemId: string; last: Date }[]>(
                `SELECT "storeId"::text AS "storeId", "itemId"::text AS "itemId", max("createdAt") AS last FROM "InventoryLedger"
                 WHERE "quantityChange" < 0 AND ($1::uuid[] IS NULL OR "storeId" = ANY($1::uuid[])) GROUP BY 1, 2`,
                storeIds,
            ),
        ]);
        // Batch 2 (3 concurrent)
        const [outflow, counts, expiring] = await Promise.all([
            prisma.$queryRawUnsafe<{ itemId: string; value: unknown }[]>(
                `SELECT "itemId"::text AS "itemId", sum(abs("quantityChange") * "unitPrice") AS value FROM "InventoryLedger"
                 WHERE "quantityChange" < 0 AND "createdAt" >= $2::timestamptz AND ($1::uuid[] IS NULL OR "storeId" = ANY($1::uuid[])) GROUP BY 1`,
                storeIds, since90,
            ),
            prisma.$queryRawUnsafe<{ storeId: string; last: Date | null }[]>(
                `SELECT s."id"::text AS "storeId", max(c."completedDate") AS last FROM "InventoryStore" s
                 LEFT JOIN "CycleCountHeader" c ON c."storeId" = s."id" AND c."completedDate" IS NOT NULL
                 WHERE ($1::uuid[] IS NULL OR s."id" = ANY($1::uuid[])) GROUP BY 1`,
                storeIds,
            ),
            prisma.$queryRawUnsafe<{ batch: string | null; item: string; expiry: Date; qty: unknown }[]>(
                `SELECT b."batchNumber" AS batch, i."code" || ' ' || i."name" AS item, b."expiryDate" AS expiry, sum(bs."quantity") AS qty
                 FROM "InventoryBatch" b JOIN "InventoryBatchStock" bs ON bs."batchId" = b."id" JOIN "InventoryItem" i ON i."id" = b."itemId"
                 WHERE b."expiryDate" IS NOT NULL AND b."expiryDate" <= $2::timestamptz AND bs."quantity" > 0 AND ($1::uuid[] IS NULL OR bs."storeId" = ANY($1::uuid[]))
                 GROUP BY 1, 2, 3 ORDER BY 3 ASC LIMIT 15`,
                storeIds, new Date(now.getTime() + 30 * DAY_MS),
            ),
        ]);

        const batchValue = new Map(batchValues.map((r) => [`${r.storeId}|${r.itemId}`, inventoryNumber(r.value)]));
        const lastOutMap = new Map(lastOut.map((r) => [`${r.storeId}|${r.itemId}`, new Date(r.last)]));
        const outflowMap = new Map(outflow.map((r) => [r.itemId, inventoryNumber(r.value)]));
        const lastCount = new Map(counts.map((r) => [r.storeId, r.last ? new Date(r.last) : null]));

        const stores = new Map<string, InventoryHealth['stores'][number]>();
        const reorder: InventoryHealth['reorder'] = [];
        const deadBuckets = new Map<string, { skus: number; value: number }>(DEAD_STOCK_BUCKETS.map((b) => [b, { skus: 0, value: 0 }]));
        const deadTop: (InventoryHealth['deadTop'][number] & { raw: number })[] = [];
        const itemValue = new Map<string, { code: string; name: string; value: number }>();
        let overAllocated = 0;

        for (const s of stocks) {
            const qty = inventoryNumber(s.quantity);
            const key = `${s.storeId}|${s.itemId}`;
            const rowValue = batchValue.get(key) ?? qty * inventoryNumber(s.item.costPrice);
            const view = stores.get(s.storeId) ?? { storeId: s.storeId, name: s.store.name, skus: 0, value: showValues ? 0 : null, belowReorder: 0, stockOut: 0, lastCountDays: null };
            if (qty > 0) { view.skus++; if (showValues && view.value !== null) view.value += rowValue; }

            const input = { quantity: s.quantity, allocatedQuantity: s.allocatedQuantity, minLevel: s.minLevel, itemMinLevel: s.item.minLevel };
            const available = availableInventoryQuantity(input);
            const min = effectiveInventoryMinLevel(input);
            if (available < 0) overAllocated++;
            const stockOut = available <= 0;
            if (isInventoryReorderNeeded(input)) {
                view.belowReorder++;
                if (stockOut) view.stockOut++;
                reorder.push({ storeId: s.storeId, store: s.store.name, code: s.item.code, name: s.item.name, available, min, stockOut });
            }
            stores.set(s.storeId, view);

            if (qty > 0) {
                const iv = itemValue.get(s.itemId) ?? { code: s.item.code, name: s.item.name, value: 0 };
                iv.value += rowValue;
                itemValue.set(s.itemId, iv);
                const last = lastOutMap.get(key);
                const days = last ? Math.floor((now.getTime() - last.getTime()) / DAY_MS) : null;
                const bucket = deadStockBucket(days);
                if (bucket) {
                    const b = deadBuckets.get(bucket)!;
                    b.skus++; b.value += rowValue;
                    deadTop.push({ store: s.store.name, code: s.item.code, name: s.item.name, quantity: qty, value: showValues ? rowValue : null, daysSinceMove: days, raw: rowValue });
                }
            }
        }

        for (const st of stores.values()) {
            const lc = lastCount.get(st.storeId);
            st.lastCountDays = lc ? Math.floor((now.getTime() - lc.getTime()) / DAY_MS) : null;
        }
        const storeList = [...stores.values()].sort((a, b) => (b.value ?? 0) - (a.value ?? 0) || b.belowReorder - a.belowReorder);
        reorder.sort((a, b) => Number(b.stockOut) - Number(a.stockOut) || (a.available - a.min) - (b.available - b.min));

        const deadValue = [...deadBuckets.values()].reduce((a, b) => a + b.value, 0);
        const turnover = [...itemValue.entries()]
            .map(([id, v]) => ({ code: v.code, name: v.name, value: showValues ? v.value : null, outflow90: showValues ? (outflowMap.get(id) ?? 0) : null, coverDays: showValues ? daysOfCover(v.value, outflowMap.get(id) ?? 0, 90) : null, raw: v.value }))
            .sort((a, b) => b.raw - a.raw)
            .slice(0, 10)
            .map((t) => ({ code: t.code, name: t.name, value: t.value, outflow90: t.outflow90, coverDays: t.coverDays }));

        return {
            asOf: now.toISOString(),
            showValues,
            stores: storeList,
            totals: {
                value: showValues ? storeList.reduce((a, s) => a + (s.value ?? 0), 0) : null,
                skus: storeList.reduce((a, s) => a + s.skus, 0),
                belowReorder: reorder.length,
                stockOut: reorder.filter((r) => r.stockOut).length,
                overAllocated,
                deadValue: showValues ? deadValue : null,
                deadSkus: [...deadBuckets.values()].reduce((a, b) => a + b.skus, 0),
            },
            reorder: reorder.slice(0, 50),
            dead: DEAD_STOCK_BUCKETS.map((b) => ({ bucket: b, skus: deadBuckets.get(b)!.skus, value: showValues ? deadBuckets.get(b)!.value : null })),
            deadTop: deadTop.sort((a, b) => b.raw - a.raw).slice(0, 15).map((d) => ({ store: d.store, code: d.code, name: d.name, quantity: d.quantity, value: d.value, daysSinceMove: d.daysSinceMove })),
            turnover,
            expiring: expiring.map((e) => ({ batch: e.batch ?? '-', item: e.item, expiry: new Date(e.expiry).toISOString(), daysLeft: Math.floor((new Date(e.expiry).getTime() - now.getTime()) / DAY_MS), quantity: inventoryNumber(e.qty) })),
            neverCountedStores: storeList.filter((s) => s.lastCountDays === null).length,
            notes: [
                'Value = batch quantity x batch cost where batches exist, otherwise on-hand quantity x item cost price.',
                'Reorder uses the store minimum, else the item minimum, against available stock (on hand minus allocated).',
                'Dead stock = on-hand stock with no outbound movement for 30+ days in the stock ledger.',
            ],
        };
    }
}
