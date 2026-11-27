import { isWholeUnit, type GateCheck } from '@/lib/purchase-flow-gates';

/**
 * Opening stock of a store at go-live (owner, 27 Nov 2026). The store's physical count is uploaded from Excel (item code, quantity, unit cost,
 * batch number, expiry date), submitted by store staff and approved by a second person. The screen shows these checks live and the server
 * refuses with the same text, so the two never disagree.
 */

export const OPENING_TEMPLATE_HEADERS = ['Item code', 'Item name', 'Unit', 'Quantity', 'Unit cost (Rs.)', 'Batch number', 'Expiry date'] as const;

export interface OpeningItem { id: string; code: string; name: string; unit: string | null; costPrice?: number | null }

/** One row as read from the sheet, before it is matched to an item. */
export interface OpeningRow { row: number; code: string; quantity: unknown; unitCost: unknown; batchNumber?: unknown; expiryDate?: unknown }

export interface OpeningLine { row: number; itemId: string | null; code: string; name: string; unit: string | null; quantity: number; unitCost: number; batchNumber: string | null; expiryDate: string | null; errors: string[] }

const num = (v: unknown): number => {
    if (typeof v === 'number') return v;
    const s = String(v ?? '').replace(/,/g, '').replace(/^Rs\.?\s*/i, '').trim();
    return s === '' ? NaN : Number(s);
};

/** A date cell: an Excel serial number, a Date, or YYYY-MM-DD / DD/MM/YYYY text. Returns YYYY-MM-DD or null (blank), or 'invalid'. */
export function sheetDate(v: unknown): string | null | 'invalid' {
    if (v === null || v === undefined || String(v).trim() === '') return null;
    if (v instanceof Date) return Number.isNaN(v.getTime()) ? 'invalid' : v.toISOString().slice(0, 10);
    if (typeof v === 'number') {
        // Excel day 1 = 1900-01-01 (with the 1900 leap-year quirk: serials above 59 are one day ahead)
        const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86_400_000);
        return Number.isNaN(d.getTime()) ? 'invalid' : d.toISOString().slice(0, 10);
    }
    const s = String(v).trim();
    let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (m) return s;
    m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return 'invalid';
}

/** Match the sheet rows to the item master and check each row on its own (a row's problems are shown on that row). */
export function readOpeningRows(rows: readonly OpeningRow[], items: readonly OpeningItem[]): OpeningLine[] {
    const byCode = new Map(items.map((i) => [i.code.trim().toUpperCase(), i]));
    const seen = new Map<string, number>();
    return rows.filter((r) => String(r.code ?? '').trim() !== '' || String(r.quantity ?? '').trim() !== '').map((r) => {
        const code = String(r.code ?? '').trim();
        const item = byCode.get(code.toUpperCase()) ?? null;
        const quantity = num(r.quantity);
        const unitCost = num(r.unitCost);
        const expiry = sheetDate(r.expiryDate);
        const errors: string[] = [];
        if (!code) errors.push('Item code is missing');
        else if (!item) errors.push(`Item code ${code} is not in the item list`);
        if (!(quantity > 0)) errors.push('Quantity must be above zero');
        else if (item && isWholeUnit(item.unit) && !Number.isInteger(quantity)) errors.push(`Whole numbers only for ${item.unit}`);
        if (!(unitCost > 0)) errors.push('Unit cost must be above zero (the value of the stock)');
        if (expiry === 'invalid') errors.push('Expiry date is not a date (use YYYY-MM-DD)');
        if (item) {
            const first = seen.get(item.id);
            if (first !== undefined) errors.push(`Listed twice (also row ${first}): put the total on one row`);
            else seen.set(item.id, r.row);
        }
        const batch = String(r.batchNumber ?? '').trim();
        return {
            row: r.row, itemId: item?.id ?? null, code, name: item?.name ?? '', unit: item?.unit ?? null,
            quantity: Number.isFinite(quantity) ? quantity : 0, unitCost: Number.isFinite(unitCost) ? Math.round(unitCost * 100) / 100 : 0,
            batchNumber: batch ? batch.slice(0, 60) : null, expiryDate: expiry === 'invalid' ? null : expiry, errors,
        };
    });
}

export interface OpeningGateInput {
    storeChosen: boolean;
    lines: readonly OpeningLine[];
    countDate: string | null;
    today: string;
    countSheetAttached: boolean;
    /** item ids that already have stock or another open load in this store */
    alreadyLoaded: readonly string[];
}

/** Before you submit: the same checks the server makes. */
export function openingSubmitGate(i: OpeningGateInput): GateCheck[] {
    const bad = i.lines.filter((l) => l.errors.length > 0);
    const loaded = i.lines.filter((l) => l.itemId && i.alreadyLoaded.includes(l.itemId));
    return [
        { key: 'store', ok: i.storeChosen, text: i.storeChosen ? 'Store chosen' : 'Choose the store that was counted' },
        { key: 'lines', ok: i.lines.length > 0, text: i.lines.length > 0 ? `${i.lines.length} item(s) on the count` : 'Upload the count sheet (Excel) with at least one item' },
        { key: 'rows', ok: bad.length === 0, text: bad.length === 0 ? 'Every row is complete and correct' : `Fix ${bad.length} row(s): ${bad.slice(0, 3).map((l) => `row ${l.row} ${l.errors[0]}`).join('; ')}` },
        { key: 'once', ok: loaded.length === 0, text: loaded.length === 0 ? 'No item already has stock or an open load in this store' : `Already loaded in this store (use a cycle count to correct): ${loaded.slice(0, 5).map((l) => l.code).join(', ')}` },
        { key: 'date', ok: !!i.countDate && i.countDate <= i.today, text: !i.countDate ? 'Enter the date the stock was counted' : i.countDate > i.today ? 'The count date cannot be in the future' : 'Count date set' },
        { key: 'sheet', ok: i.countSheetAttached, text: i.countSheetAttached ? 'Signed count sheet attached' : 'Attach the scan of the signed physical count sheet' },
    ];
}

export interface OpeningApproveInput { status: string; actorId: string; createdById: string; isAdmin: boolean; rejecting: boolean; reason?: string | null; alreadyLoaded: readonly string[] }

/** Before you approve (or reject): the second person checks the count. */
export function openingApproveGate(i: OpeningApproveInput): GateCheck[] {
    const own = !i.isAdmin && i.actorId === i.createdById;
    const out: GateCheck[] = [
        { key: 'status', ok: i.status === 'SUBMITTED', text: i.status === 'SUBMITTED' ? 'The load is waiting for approval' : `This load is ${i.status.toLowerCase()}` },
        { key: 'sod', ok: !own, text: own ? 'You submitted this load, so another person approves it' : 'You did not submit this load' },
    ];
    if (i.rejecting) out.push({ key: 'reason', ok: (i.reason ?? '').trim().length >= 3, text: (i.reason ?? '').trim().length >= 3 ? 'Reason given' : 'Say why the load is rejected' });
    else out.push({ key: 'once', ok: i.alreadyLoaded.length === 0, text: i.alreadyLoaded.length === 0 ? 'No item has stock in this store yet' : `${i.alreadyLoaded.length} item(s) got stock in this store since it was submitted: reject and load them again` });
    return out;
}

export const linesTotal = (lines: readonly { quantity: number; unitCost: number }[]) => ({
    qty: Math.round(lines.reduce((s, l) => s + l.quantity, 0) * 10_000) / 10_000,
    value: Math.round(lines.reduce((s, l) => s + l.quantity * l.unitCost, 0) * 100) / 100,
});
