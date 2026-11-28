// Pure rules of the contractor material balance (no database): used by ContractorBalanceService and the unit tests.
/**
 * Contractor material balance from the documents that move the contractor's stock:
 *   issued (MIN, not rejected) - SOD used - SOD and noted wastage - accepted returns (MRN accepted quantity) = expected in hand.
 * An SOD line counts only when it took stock from a batch (`batchId` set): lines without a batch never moved the current
 * stock (written before batch picking / before the 27 Nov 2026 fresh start) and a rollback no longer gives them back.
 * The expected figure is compared with ContractorStock (what the screens show as in hand); any difference is a MISMATCH.
 */
export type MovementKind = 'ISSUED' | 'USED' | 'WASTAGE' | 'RETURNED';
export interface Movement { itemId: string; code: string; name: string; unit: string; kind: MovementKind; qty: number; at: Date; teamId?: string | null }
export interface BalanceRow {
    itemId: string; itemCode: string; itemName: string; unit: string;
    opening: number; issued: number; used: number; wastage: number; returned: number;
    closing: number;          // opening + issued - used - wastage - returned (for the period)
    expectedNow: number;      // all movements up to now
    inHand: number;           // ContractorStock quantity
    variance: number;         // inHand - expectedNow
}

const r4 = (v: number) => Math.round(v * 10000) / 10000;
const SIGN: Record<MovementKind, number> = { ISSUED: 1, USED: -1, WASTAGE: -1, RETURNED: -1 };

/** Pure: fold movements into rows. `period` limits the issued/used/wastage/returned columns; earlier movements form the opening. */
export function buildContractorBalance(
    movements: Movement[],
    inHand: Array<{ itemId: string; code: string; name: string; unit: string; quantity: number }>,
    period?: { start: Date; end: Date } | null,
    teamId?: string | null,
): BalanceRow[] {
    const rows = new Map<string, BalanceRow>();
    const row = (m: { itemId: string; code: string; name: string; unit: string }) => {
        let r = rows.get(m.itemId);
        if (!r) {
            r = { itemId: m.itemId, itemCode: m.code, itemName: m.name, unit: m.unit, opening: 0, issued: 0, used: 0, wastage: 0, returned: 0, closing: 0, expectedNow: 0, inHand: 0, variance: 0 };
            rows.set(m.itemId, r);
        }
        return r;
    };
    for (const s of inHand) row({ itemId: s.itemId, code: s.code, name: s.name, unit: s.unit }).inHand = Number(s.quantity);
    for (const m of movements) {
        const r = row(m);
        const signed = SIGN[m.kind] * m.qty;
        r.expectedNow += signed;
        // a team view shows only that team's SOD lines; issues and returns belong to the contractor, not to a team
        if (teamId && (m.kind === 'USED' || m.kind === 'WASTAGE') && m.teamId !== teamId) continue;
        if (teamId && (m.kind === 'ISSUED' || m.kind === 'RETURNED')) continue;
        if (period && m.at < period.start) { r.opening += signed; continue; }
        if (period && m.at >= period.end) continue;
        if (m.kind === 'ISSUED') r.issued += m.qty;
        else if (m.kind === 'USED') r.used += m.qty;
        else if (m.kind === 'WASTAGE') r.wastage += m.qty;
        else r.returned += m.qty;
    }
    return [...rows.values()].map((r) => {
        const out = { ...r };
        for (const k of ['opening', 'issued', 'used', 'wastage', 'returned', 'expectedNow', 'inHand'] as const) out[k] = r4(out[k]);
        out.closing = r4(out.opening + out.issued - out.used - out.wastage - out.returned);
        out.variance = r4(out.inHand - out.expectedNow);
        return out;
    }).sort((a, b) => a.itemCode.localeCompare(b.itemCode));
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
/** "July" / "7" / "07" / "2026-07" with a year -> [start, end) of that month (Colombo dates as UTC midnights are close enough for a month view). */
export function monthPeriod(month?: string | null, year?: string | number | null): { start: Date; end: Date } | null {
    if (!month || month === 'ALL') return null;
    let y = year ? Number(year) : new Date().getFullYear();
    let m: number;
    const iso = /^(\d{4})-(\d{1,2})$/.exec(month);
    if (iso) { y = Number(iso[1]); m = Number(iso[2]) - 1; }
    else if (/^\d{1,2}$/.test(month)) m = Number(month) - 1;
    else m = MONTHS.indexOf(month.toLowerCase());
    if (!(m >= 0 && m < 12) || !Number.isFinite(y)) return null;
    return { start: new Date(Date.UTC(y, m, 1)), end: new Date(Date.UTC(y, m + 1, 1)) };
}
