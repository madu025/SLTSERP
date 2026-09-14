import { prisma } from '@/lib/prisma';

// Roles that can see LKR cost columns in this report
const COST_VISIBLE_ROLES = new Set([
  'SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP',
  'OSP_MANAGER', 'MANAGER', 'FINANCE_MANAGER',
  'STORES_MANAGER',
]);

// Roles whose RTOM scope is limited to their own assigned RTOM
const RTOM_SCOPED_ROLES = new Set([
  'ENGINEER', 'ASSISTANT_ENGINEER', 'AREA_COORDINATOR', 'QC_OFFICER',
]);

export interface MaterialSummaryFilters {
  year?: number;
  month?: number;       // 1–12; if omitted returns all months in the year
  rtom?: string;        // explicit RTOM filter (from query param)
  itemCode?: string;
  /** Role of the requesting user — drives cost visibility + RTOM scoping */
  viewerRole?: string;
  /** Assigned RTOM of the requesting user (for RTOM-scoped roles) */
  scopedRtom?: string;
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
  sodIds: Set<string>;
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
    const { viewerRole, scopedRtom } = filters;
    const canViewCosts = COST_VISIBLE_ROLES.has(viewerRole ?? '');
    const isRtomScoped = RTOM_SCOPED_ROLES.has(viewerRole ?? '');

    // RTOM enforcement: scoped roles can only see their own RTOM
    const effectiveRtom = isRtomScoped
      ? (scopedRtom ?? filters.rtom)    // ignore explicit filter override
      : (filters.rtom ?? undefined);
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

    const usageLines = await prisma.sODMaterialUsage.findMany({
      where: {
        serviceOrder: {
          ...(effectiveRtom ? { rtom: effectiveRtom } : {}),
          ...(completedFrom && completedTo
            ? { completedDate: { gte: completedFrom, lte: completedTo } }
            : { completedDate: { not: null } }),
        },
        ...(filters.itemCode ? { item: { code: filters.itemCode } } : {}),
      },
      select: {
        id: true,
        quantity: true,
        unitPrice: true,
        costPrice: true,
        unit: true,
        exceedsLimit: true,
        serviceOrder: {
          select: { id: true, rtom: true, completedDate: true },
        },
        item: {
          select: { code: true, name: true },
        },
      },
    });

    const buckets = new Map<string, Bucket>();
    const distinctRtomsSet = new Set<string>();
    const distinctItemsMap = new Map<string, string>();
    const distinctMonthsSet = new Set<string>();

    for (const line of usageLines) {
      if (!line.serviceOrder.completedDate) continue;

      const d        = line.serviceOrder.completedDate;
      const year     = d.getFullYear();
      const month    = d.getMonth() + 1;
      const rtom     = line.serviceOrder.rtom;
      const itemCode = line.item.code;
      const key      = `${rtom}|${year}|${month}|${itemCode}`;
      const qty      = Number(line.quantity);
      const cost     = Number(line.costPrice ?? line.unitPrice ?? 0) * qty;

      distinctRtomsSet.add(rtom);
      distinctItemsMap.set(itemCode, line.item.name);
      distinctMonthsSet.add(`${year}|${month}`);

      const b = buckets.get(key);
      if (b) {
        b.totalQuantity += qty;
        b.totalCostLkr  += cost;
        b.sodIds.add(line.serviceOrder.id);
        if (line.exceedsLimit) b.exceedsLimitCount++;
      } else {
        buckets.set(key, {
          rtom, year, month, itemCode,
          itemName: line.item.name,
          unit: line.unit,
          totalQuantity: qty,
          totalCostLkr: cost,
          sodIds: new Set([line.serviceOrder.id]),
          exceedsLimitCount: line.exceedsLimit ? 1 : 0,
        });
      }
    }

    const rows: MaterialSummaryRow[] = [];
    let grandQty = 0, grandCost = 0, grandSods = 0;

    for (const b of buckets.values()) {
      const sodCount = b.sodIds.size;
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
      scopedRtomLabel: isRtomScoped ? (scopedRtom ?? undefined) : undefined,
    };
  }
}
