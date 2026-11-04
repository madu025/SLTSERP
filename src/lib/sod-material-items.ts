/**
 * Picks the right inventory item from a contractor's van stock for the SOD material form.
 * Matching is by exact item code, never by substring: "OSP-NC-ACC-DWRETNER" (Drop Wire Retainer)
 * contains "DW" and used to be picked as the drop wire, so metres were booked against retainers.
 */

/** Drop wire measured in meters: G1/indoor DW and F1 SLT drop cable. */
export const DROP_WIRE_ITEM_CODES: readonly string[] = ['OSPFTA003', 'OSP-HC-CBL-DW'];

interface StockLike<T> {
  quantity?: number | string | null;
  item: T & { code?: string | null; name?: string | null };
}

const upper = (v?: string | null) => (v || '').trim().toUpperCase();

/** Prefers the drop wire the contractor actually holds (largest quantity), then any catalogued one. */
export function pickDropWireStock<T, S extends StockLike<T>>(stockItems: S[]): S | undefined {
  const matches = stockItems.filter((s) => DROP_WIRE_ITEM_CODES.includes(upper(s.item.code)));
  return [...matches].sort((a, b) => Number(b.quantity ?? 0) - Number(a.quantity ?? 0))[0];
}

/** ONT / ONU devices: whole-word match so "POINT", "FRONT" or "CONTROLLER" are not mistaken for an ONT. */
export function pickOntStock<T, S extends StockLike<T>>(stockItems: S[]): S | undefined {
  const isOnt = (v: string) => /(^|[^A-Z0-9])(ONT|ONU)([^A-Z0-9]|$)/.test(v) || v.includes('ONT ROUTER');
  return stockItems.find((s) => isOnt(upper(s.item.code)) || isOnt(upper(s.item.name)));
}
