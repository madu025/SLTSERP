import { MaterialUsageRow } from "./types";

export function formatMaterialUsage(rows: MaterialUsageRow[]) {
    return rows.flatMap(row => {
        const items = [];
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
}
