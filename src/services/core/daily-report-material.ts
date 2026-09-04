/**
 * Daily Operational Report - material consumption totals (DW / Poles).
 *
 * Deliberately separate from the day-attribution rules: this module only answers
 * "how much material did these SODs consume", while report.service.ts decides
 * *which* SODs belong to the day (an SOD counts as consuming material on the day
 * its work was completed / install-closed - see daily-report-activity.ts).
 *
 * Item matching is code-driven, never name-driven. The previous name heuristic
 * (`name.includes('drop wire')`) also matched "Fiber Drop Wire Retainer"
 * (OSPFTA005) and "Drop Wire Retainer" (OSP-NC-ACC-DWRETNER), both counted in
 * Nos, and the pole branch keyed on an item *category* that never exists
 * (every pole item sits in category OSP-FTTH), which kept the pole columns dead.
 */
import type { Prisma } from '@prisma/client';

export type DailyMaterialBucket = 'dw' | 'pole56' | 'pole67' | 'pole80';
export type DailyPoleBucket = Exclude<DailyMaterialBucket, 'dw'>;

/** Drop wire measured in meters: G1/indoor DW and F1 SLT drop cable. */
export const DROP_WIRE_ITEM_CODES: readonly string[] = ['OSPFTA003', 'OSP-HC-CBL-DW'];

/** Pole items that exist in the item master, keyed by exact item code. */
export const POLE_ITEM_CODE_BUCKETS: Record<string, DailyPoleBucket> = {
  'OSP-POLE-5.6LL': 'pole56',
  OSPCPL008: 'pole56',
  'OSP-POLE-6.7LL': 'pole67',
  OSPCPL009: 'pole67',
  'OSP-POLE-8MH': 'pole80',
  OSPCPL004: 'pole80',
};

export interface DailyMaterialTotals {
  /** SLT-sourced drop wire (deducted from the SLT invoice). */
  dwSlt: number;
  /** SLTS/contractor-sourced drop wire. */
  dwCompany: number;
  dw: number;
  pole56: number;
  pole67: number;
  pole80: number;
}

export interface MaterialUsageLike {
  quantity: Prisma.Decimal | number | string | null;
  item: { code: string | null } | null;
}

export interface ErectedPoleLike {
  poleType: string | null;
}

export interface MaterialSodLike {
  /** 'SLT' when SLT sourced; anything else is treated as SLTS/contractor sourced. */
  materialSource?: string | null;
  materialUsage: readonly MaterialUsageLike[];
  erectedPoles?: readonly ErectedPoleLike[];
}

export const createEmptyMaterialTotals = (): DailyMaterialTotals => ({
  dwSlt: 0,
  dwCompany: 0,
  dw: 0,
  pole56: 0,
  pole67: 0,
  pole80: 0,
});

/** Decimal | number | string -> finite number (0 when unusable). */
export function toQuantity(value: Prisma.Decimal | number | string | null): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value && typeof value === 'object' && 'toNumber' in value) {
    const parsed = value.toNumber();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/** Which report bucket an inventory item belongs to (null = not report material). */
export function classifyItemCode(code: string | null | undefined): DailyMaterialBucket | null {
  const normalized = (code || '').trim().toUpperCase();
  if (!normalized) return null;
  if (DROP_WIRE_ITEM_CODES.includes(normalized)) return 'dw';
  return POLE_ITEM_CODE_BUCKETS[normalized] ?? null;
}

/**
 * Pole length bucket from a SODErectedPole.poleType value.
 * Stored form is `sizeType|SLT|CONTRACTOR|CONCRETE` (see OrderSheetMode), with the
 * legacy bare codes 'SLTPL' (SLT provided 5.6m) and plain size codes. GI poles have
 * no report column and are intentionally excluded.
 */
export function classifyPoleType(poleType: string | null | undefined): DailyPoleBucket | null {
  const raw = (poleType || '').trim().toUpperCase();
  if (!raw) return null;
  const sizeType = raw.split('|')[0].trim();
  if (sizeType === 'SLTPL') return 'pole56';
  const compact = sizeType.replace(/[^A-Z0-9]/g, '');
  if (/^PLC?5[.,]?6/.test(compact) || /^5[.,]6/.test(compact)) return 'pole56';
  if (/^PLC?6[.,]?7/.test(compact) || /^6[.,]7/.test(compact)) return 'pole67';
  if (/^PLC?8/.test(compact) || /^8[.,]?0?$/.test(compact)) return 'pole80';
  return null;
}

/** Sum drop wire and poles for the given SODs. Pure - the caller owns day attribution. */
export function sumMaterialsForSods(sods: readonly MaterialSodLike[]): DailyMaterialTotals {
  const totals = createEmptyMaterialTotals();

  for (const sod of sods) {
    const isSltSourced = (sod.materialSource || '').trim().toUpperCase() === 'SLT';

    for (const usage of sod.materialUsage) {
      const bucket = classifyItemCode(usage.item?.code);
      if (!bucket) continue;
      const quantity = toQuantity(usage.quantity);
      if (!quantity) continue;

      if (bucket === 'dw') {
        totals.dw += quantity;
        if (isSltSourced) totals.dwSlt += quantity;
        else totals.dwCompany += quantity;
      } else {
        totals[bucket] += quantity;
      }
    }

    // Poles are physically recorded on the SOD, not issued through stores.
    for (const pole of sod.erectedPoles ?? []) {
      const bucket = classifyPoleType(pole.poleType);
      if (bucket) totals[bucket] += 1;
    }
  }

  return totals;
}
