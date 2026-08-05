import { MaterialUsageRow } from "@/types/service-order/order-action.types";

export function formatMaterialUsage(rows: MaterialUsageRow[]) {
    const flat = rows.flatMap(row => {
        const items: Array<{
            itemId: string;
            quantity: string;
            usageType: string;
            serialNumber?: string;
            comment?: string;
        }> = [];
        if (!row.itemId) return [];

        // F1 / G1 for Drop Wire
        if (row.f1Qty && parseFloat(row.f1Qty) > 0) {
            items.push({ itemId: row.itemId, quantity: row.f1Qty, usageType: 'USED_F1', serialNumber: row.serialNumber });
        }
        if (row.g1Qty && parseFloat(row.g1Qty) > 0) {
            items.push({ itemId: row.itemId, quantity: row.g1Qty, usageType: 'USED_G1', serialNumber: row.serialNumber });
        }

        // Standard 'Used' if not F1/G1
        if (!row.f1Qty && !row.g1Qty && row.usedQty && parseFloat(row.usedQty) > 0) {
            items.push({ itemId: row.itemId, quantity: row.usedQty, usageType: 'USED', serialNumber: row.serialNumber });
        }

        // Wastage
        if (row.wastageQty && parseFloat(row.wastageQty) > 0) {
            items.push({
                itemId: row.itemId,
                quantity: row.wastageQty,
                usageType: 'WASTAGE',
                serialNumber: row.serialNumber,
                comment: row.wastageReason
            });
        }

        return items;
    });

    // Deduplicate: merge same itemId + usageType by summing quantities.
    // Serial number is part of the merge key so distinct serials (e.g. two STBs
    // of the same item) stay as separate entries — backend updates serial ledger per entry.
    const mergeMap = new Map<string, typeof flat[number]>();
    for (const entry of flat) {
        const serialKey = entry.serialNumber?.trim() || '';
        const key = `${entry.itemId}::${entry.usageType}::${serialKey}`;
        const existing = mergeMap.get(key);
        if (existing) {
            const sum = parseFloat(existing.quantity) + parseFloat(entry.quantity);
            existing.quantity = String(isNaN(sum) ? 0 : sum);
            // Merge comments
            if (entry.comment && existing.comment && existing.comment !== entry.comment) {
                existing.comment = `${existing.comment}; ${entry.comment}`;
            } else if (entry.comment && !existing.comment) {
                existing.comment = entry.comment;
            }
        } else {
            mergeMap.set(key, { ...entry });
        }
    }

    return Array.from(mergeMap.values());
}
