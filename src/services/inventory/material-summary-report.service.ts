import { prisma } from '@/lib/prisma';

export interface MaterialSummaryFilters {
  year?: number;
  month?: number;       // 1–12; if omitted returns all months in the year
  rtom?: string;
  itemCode?: string;
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
   * Joins: SODMaterialUsage → ServiceOrder (rtom, completedDate) → InventoryItem (code, name).
   */
  static async generate(filters: MaterialSummaryFilters): Promise<MaterialSummaryReport> {
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
          ...(filters.rtom ? { rtom: filters.rtom } : {}),
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
        totalCostLkr:  Math.round((b.totalCostLkr  + Number.EPSILON) * 100) / 100,
        sodCount,
        avgQtyPerSod:  sodCount > 0 ? Math.round((b.totalQuantity / sodCount + Number.EPSILON) * 100) / 100 : 0,
        exceedsLimitCount: b.exceedsLimitCount,
      });
      grandQty  += b.totalQuantity;
      grandCost += b.totalCostLkr;
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
    };
  }
}
