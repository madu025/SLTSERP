import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export interface MaterialSummaryFilters {
  year?: number;
  month?: number;       // 1–12; if omitted returns all months in the year
  rtom?: string;        // explicit RTOM filter (from query param)
  itemCode?: string;
  /** Canonical permission-derived cost visibility */
  canViewCosts?: boolean;
  /** Server-resolved RTOM allowlist; undefined means global scope */
  allowedRtoms?: string[];
}

export interface MaterialSummaryRow {
  rtom: string;
  year: number;
  month: number;
  monthLabel: string;
  itemCode: string;
  itemName: string;
  unit: string;
  totalQuantity: number;
  totalCostLkr: number;
  sodCount: number;
  avgQtyPerSod: number;
  exceedsLimitCount: number;
}

export interface MaterialSummaryTotals {
  totalQuantity: number;
  totalCostLkr: number;
  totalSodCount: number;
  rowCount: number;
}

export interface MaterialSummaryReport {
  rows: MaterialSummaryRow[];
  totals: MaterialSummaryTotals;
  distinctRtoms: string[];
  distinctItems: { code: string; name: string }[];
  distinctMonths: { year: number; month: number; label: string }[];
  /** UI flag: whether the viewer's role permits seeing LKR cost columns */
  canViewCosts: boolean;
  /** UI flag: whether this is a scoped (RTOM-limited) view */
  isScopedView: boolean;
  scopedRtomLabel?: string;
}

const MONTH_LABELS = [
  '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

interface Bucket {
  rtom: string;
  year: number;
  month: number;
  itemCode: string;
  itemName: string;
  unit: string;
  totalQuantity: number;
  totalCostLkr: number;
  sodCount: number;
  exceedsLimitCount: number;
}

export class MaterialSummaryReportService {
  /**
   * Aggregates SODMaterialUsage by rtom/year/month/item using an O(N) Map pass.
   * Role-based data scoping:
   *   - FINANCE_MANAGER / STORES_MANAGER / Executives → full cost data, all RTOMs
   *   - OSP_MANAGER / MANAGER → full cost data, all RTOMs
   *   - ENGINEER / AREA_COORDINATOR / QC_OFFICER → quantity only, own RTOM only
   *   - AREA_MANAGER → quantity only, all RTOMs
   */
  static async generate(filters: MaterialSummaryFilters): Promise<MaterialSummaryReport> {
    const canViewCosts = filters.canViewCosts === true;
    const isRtomScoped = filters.allowedRtoms !== undefined;
    const effectiveRtoms = filters.allowedRtoms === undefined
      ? (filters.rtom ? [filters.rtom] : undefined)
      : filters.rtom
        ? (filters.allowedRtoms.includes(filters.rtom) ? [filters.rtom] : [])
        : filters.allowedRtoms;
    let completedFrom: Date | undefined;
    let completedTo: Date | undefined;

    if (filters.year) {
      if (filters.month) {
        completedFrom = new Date(filters.year, filters.month - 1, 1);
        completedTo   = new Date(filters.year, filters.month, 0, 23, 59, 59, 999);
      } else {
        completedFrom = new Date(filters.year, 0, 1);
        completedTo   = new Date(filters.year, 11, 31, 23, 59, 59, 999);
      }
    }

    // Grouped in the database: pulling every SOD material line into Node to sum it there did not finish within 25 s
    // on the production data set. Only the finished buckets (RTOM x month x item) come back.
    const conditions: Prisma.Sql[] = [Prisma.sql`s."completedDate" IS NOT NULL`];
    if (completedFrom && completedTo) {
      conditions.push(Prisma.sql`s."completedDate" >= ${completedFrom} AND s."completedDate" <= ${completedTo}`);
    }
    if (effectiveRtoms) conditions.push(Prisma.sql`s."rtom" = ANY(${effectiveRtoms}::text[])`);
    if (filters.itemCode) conditions.push(Prisma.sql`i."code" = ${filters.itemCode}`);

    const aggregated = await prisma.$queryRaw<Array<{
      rtom: string; year: number; month: number; code: string; name: string; unit: string;
      qty: number; cost: number; sods: number; exceeds: number;
    }>>(Prisma.sql`
      SELECT s."rtom" AS rtom,
             EXTRACT(YEAR FROM s."completedDate")::int AS year,
             EXTRACT(MONTH FROM s."completedDate")::int AS month,
             i."code" AS code,
             MIN(i."name") AS name,
             MIN(u."unit") AS unit,
             SUM(u."quantity")::float8 AS qty,
             SUM(COALESCE(u."costPrice", u."unitPrice", 0) * u."quantity")::float8 AS cost,
             COUNT(DISTINCT s."id")::int AS sods,
             COUNT(*) FILTER (WHERE u."exceedsLimit")::int AS exceeds
      FROM "SODMaterialUsage" u
      JOIN "ServiceOrder" s ON s."id" = u."serviceOrderId"
      JOIN "InventoryItem" i ON i."id" = u."itemId"
      WHERE ${Prisma.join(conditions, ' AND ')}
      GROUP BY s."rtom", EXTRACT(YEAR FROM s."completedDate"), EXTRACT(MONTH FROM s."completedDate"), i."code"
    `);

    const buckets = new Map<string, Bucket>();
    const distinctRtomsSet = new Set<string>();
    const distinctItemsMap = new Map<string, string>();
    const distinctMonthsSet = new Set<string>();

    for (const row of aggregated) {
      distinctRtomsSet.add(row.rtom);
      distinctItemsMap.set(row.code, row.name);
      distinctMonthsSet.add(`${row.year}|${row.month}`);
      buckets.set(`${row.rtom}|${row.year}|${row.month}|${row.code}`, {
        rtom: row.rtom,
        year: row.year,
        month: row.month,
        itemCode: row.code,
        itemName: row.name,
        unit: row.unit,
        totalQuantity: Number(row.qty),
        totalCostLkr: Number(row.cost),
        sodCount: Number(row.sods),
        exceedsLimitCount: Number(row.exceeds),
      });
    }

    const rows: MaterialSummaryRow[] = [];
    let grandQty = 0, grandCost = 0, grandSods = 0;

    for (const b of buckets.values()) {
      const sodCount = b.sodCount;
      rows.push({
        rtom: b.rtom,
        year: b.year,
        month: b.month,
        monthLabel: MONTH_LABELS[b.month] ?? `M${b.month}`,
        itemCode: b.itemCode,
        itemName: b.itemName,
        unit: b.unit,
        totalQuantity: Math.round((b.totalQuantity + Number.EPSILON) * 100) / 100,
        // Cost columns: zero-out for non-cost roles (quantity-only view)
        totalCostLkr: canViewCosts ? Math.round((b.totalCostLkr + Number.EPSILON) * 100) / 100 : 0,
        sodCount,
        avgQtyPerSod: sodCount > 0 ? Math.round((b.totalQuantity / sodCount + Number.EPSILON) * 100) / 100 : 0,
        exceedsLimitCount: b.exceedsLimitCount,
      });
      grandQty  += b.totalQuantity;
      grandCost += canViewCosts ? b.totalCostLkr : 0;
      grandSods += sodCount;
    }

    rows.sort((a, b) =>
      a.rtom.localeCompare(b.rtom) ||
      a.year - b.year ||
      a.month - b.month ||
      a.itemCode.localeCompare(b.itemCode)
    );

    const distinctMonths = [...distinctMonthsSet]
      .map(s => { const [y, m] = s.split('|').map(Number); return { year: y, month: m, label: `${MONTH_LABELS[m]} ${y}` }; })
      .sort((a, b) => a.year - b.year || a.month - b.month);

    return {
      rows,
      totals: {
        totalQuantity: Math.round((grandQty  + Number.EPSILON) * 100) / 100,
        totalCostLkr:  Math.round((grandCost + Number.EPSILON) * 100) / 100,
        totalSodCount: grandSods,
        rowCount: rows.length,
      },
      distinctRtoms:  [...distinctRtomsSet].sort(),
      distinctItems:  [...distinctItemsMap.entries()].map(([code, name]) => ({ code, name })).sort((a, b) => a.code.localeCompare(b.code)),
      distinctMonths,
      canViewCosts,
      isScopedView: isRtomScoped,
      scopedRtomLabel: isRtomScoped && effectiveRtoms?.length === 1 ? effectiveRtoms[0] : undefined,
    };
  }
}
