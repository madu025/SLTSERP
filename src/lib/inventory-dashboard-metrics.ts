/**
 * Shared inventory balance rules used by dashboards and alert projections.
 *
 * InventoryStock.quantity is physical on-hand stock. allocatedQuantity is
 * already committed to reservations and must not be counted as available.
 * A store-level minLevel overrides the item default when it is positive.
 */
export interface InventoryStockBalanceInput {
    quantity: unknown;
    allocatedQuantity?: unknown | null;
    minLevel?: unknown | null;
    itemMinLevel?: unknown | null;
}

export function inventoryNumber(value: unknown): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

export function effectiveInventoryMinLevel(row: InventoryStockBalanceInput): number {
    const storeMin = inventoryNumber(row.minLevel);
    return storeMin > 0 ? storeMin : Math.max(0, inventoryNumber(row.itemMinLevel));
}

export function availableInventoryQuantity(row: InventoryStockBalanceInput): number {
    return inventoryNumber(row.quantity) - inventoryNumber(row.allocatedQuantity);
}

export function isInventoryReorderNeeded(row: InventoryStockBalanceInput): boolean {
    const available = availableInventoryQuantity(row);
    const minimum = effectiveInventoryMinLevel(row);
    return available < 0 || (minimum > 0 && available <= minimum);
}

export function isInventoryOverAllocated(row: InventoryStockBalanceInput): boolean {
    return availableInventoryQuantity(row) < 0;
}
