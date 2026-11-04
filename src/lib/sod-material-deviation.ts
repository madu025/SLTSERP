/**
 * Compare what SLT reported for a service order (extension / API) with the material the
 * contractor or staff entered manually. Pure functions, no database access.
 */

export type DeviationType =
  | 'MATCH'
  | 'QTY_MISMATCH' // both sides have the item, quantities differ
  | 'NOT_ENTERED' // SLT reported it, nobody entered it manually
  | 'NOT_REPORTED' // entered manually, SLT did not report it
  | 'UNMAPPED'; // SLT reported something that is not mapped to an inventory item yet

export interface ReportedLine {
  itemId: string | null;
  label: string; // code / name as SLT sent it
  quantity: number;
}

export interface ManualLine {
  itemId: string;
  usageType: string;
  quantity: number;
}

export interface DeviationLine {
  type: DeviationType;
  itemId: string | null;
  label: string;
  reportedQty: number;
  manualQty: number;
  wastageQty: number;
  difference: number; // manual - reported
}

/** Usage types that mean "consumed on the job"; WASTAGE is tracked apart, PORTAL_SYNC is legacy auto data. */
export const MANUAL_USED_TYPES = ['USED', 'USED_F1', 'USED_G1'] as const;

const EPSILON = 0.0001;
const round = (n: number) => Math.round(n * 10000) / 10000;

export function compareMaterial(reported: ReportedLine[], manual: ManualLine[]): DeviationLine[] {
  const rep = new Map<string, { label: string; qty: number }>();
  const unmapped: DeviationLine[] = [];
  for (const r of reported) {
    if (!r.itemId) {
      unmapped.push({ type: 'UNMAPPED', itemId: null, label: r.label, reportedQty: round(r.quantity), manualQty: 0, wastageQty: 0, difference: round(-r.quantity) });
      continue;
    }
    const cur = rep.get(r.itemId);
    if (cur) cur.qty += r.quantity;
    else rep.set(r.itemId, { label: r.label, qty: r.quantity });
  }

  const used = new Map<string, number>();
  const wasted = new Map<string, number>();
  for (const m of manual) {
    if ((MANUAL_USED_TYPES as readonly string[]).includes(m.usageType)) used.set(m.itemId, (used.get(m.itemId) || 0) + m.quantity);
    else if (m.usageType === 'WASTAGE') wasted.set(m.itemId, (wasted.get(m.itemId) || 0) + m.quantity);
  }

  const lines: DeviationLine[] = [...unmapped];
  const ids = new Set<string>([...rep.keys(), ...used.keys()]);
  for (const id of ids) {
    const r = rep.get(id);
    const reportedQty = r?.qty ?? 0;
    const manualQty = used.get(id) ?? 0;
    const diff = manualQty - reportedQty;
    let type: DeviationType;
    if (r && manualQty === 0) type = 'NOT_ENTERED';
    else if (!r) type = 'NOT_REPORTED';
    else type = Math.abs(diff) <= EPSILON ? 'MATCH' : 'QTY_MISMATCH';
    lines.push({ type, itemId: id, label: r?.label ?? '', reportedQty: round(reportedQty), manualQty: round(manualQty), wastageQty: round(wasted.get(id) ?? 0), difference: round(diff) });
  }
  return lines;
}

export function hasDeviation(lines: DeviationLine[]): boolean {
  return lines.some((l) => l.type !== 'MATCH');
}
