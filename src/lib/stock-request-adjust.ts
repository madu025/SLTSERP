/**
 * A review of a material request: the Stores Executive (or any approver) changes the quantities that will be approved, before the approval.
 * Pure rules, so the service and the tests share them.
 */
export interface QtyAdjustmentInput { id: string; approvedQty?: number }

export interface QtyAdjustment { id: string; approvedQty: number }

export function validateQtyAdjustment(
    items: QtyAdjustmentInput[] | undefined,
    existing: ReadonlyArray<{ id: string; requestedQty: unknown }>,
    remarks: string | undefined,
): { ok: true; changes: QtyAdjustment[] } | { ok: false; message: string } {
    if (!remarks || remarks.trim().length < 3) return { ok: false, message: 'Write the reason for the change (at least 3 characters).' };
    if (!items || items.length === 0) return { ok: false, message: 'Nothing to change: no quantities were sent.' };
    const known = new Map(existing.map((e) => [e.id, Number(e.requestedQty)]));
    const seen = new Set<string>();
    const changes: QtyAdjustment[] = [];
    for (const it of items) {
        if (!known.has(it.id)) return { ok: false, message: 'A line does not belong to this request.' };
        if (seen.has(it.id)) return { ok: false, message: 'A line is listed twice.' };
        seen.add(it.id);
        const q = Number(it.approvedQty);
        if (!Number.isFinite(q) || q < 0) return { ok: false, message: 'A quantity must be zero or more.' };
        changes.push({ id: it.id, approvedQty: Math.round(q * 1000) / 1000 });
    }
    return { ok: true, changes };
}
