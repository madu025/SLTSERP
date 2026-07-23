import { prisma } from '@/lib/prisma';

// ─────────────────────────────────────────────────────────────────────────────
// Material Audit Report Service
// Aggregates 20-month material movements, discrepancy totals, and financial impact.
// Big-O: DB-side groupBy O(N/k)
// ─────────────────────────────────────────────────────────────────────────────

export interface MaterialItemAuditSummary {
  itemCode: string;
  itemName: string;
  unit: string;
  totalReceivedQty: number;
  totalUsageQty: number;
  totalWastageQty: number;
  totalFaultyQty: number;
  totalUsageAndWastageQty: number;
  calculatedBalanceQty: number;
  totalReceivedCostLkr: number;
  totalUsageCostLkr: number;
  netFinancialVarianceLkr: number;
  discrepancyStatus: 'SURPLUS' | 'DEFICIT' | 'BALANCED';
  recordsCount: number;
}

export interface ExecutiveAuditSummary {
  opmcId?: string | null;
  totalReceivedCostLkr: number;
  totalUsageCostLkr: number;
  netDiscrepancyLkr: number;
  itemsAuditedCount: number;
  discrepancyItemsCount: number;
  itemSummaries: MaterialItemAuditSummary[];
}

export class MaterialAuditReportService {
  /**
   * Build complete Executive Material Audit Summary for an OPMC.
   * O(N/k) DB groupBy aggregation.
   */
  static async getExecutiveAuditSummary(opmcId?: string | null): Promise<ExecutiveAuditSummary> {
    const where = opmcId && opmcId !== 'ALL' ? { opmcId } : {};
    const records = await prisma.preErpMaterialBalance.findMany({
      where,
      include: { item: { select: { code: true, name: true, unit: true } } },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
    });

    const itemMap = new Map<string, MaterialItemAuditSummary>();

    for (const r of records) {
      const code = r.itemCode;
      if (!itemMap.has(code)) {
        itemMap.set(code, {
          itemCode: code,
          itemName: r.itemName || r.item.name,
          unit: r.item.unit,
          totalReceivedQty: 0,
          totalUsageQty: 0,
          totalWastageQty: 0,
          totalFaultyQty: 0,
          totalUsageAndWastageQty: 0,
          calculatedBalanceQty: 0,
          totalReceivedCostLkr: 0,
          totalUsageCostLkr: 0,
          netFinancialVarianceLkr: 0,
          discrepancyStatus: 'BALANCED',
          recordsCount: 0,
        });
      }

      const summary = itemMap.get(code)!;
      summary.totalReceivedQty += r.receivedQuantity;
      summary.totalUsageQty += r.usageQuantity;
      summary.totalWastageQty += r.wastageQuantity;
      summary.totalFaultyQty += r.faultyQuantity;
      summary.totalUsageAndWastageQty += r.totalUsageQuantity;
      summary.totalReceivedCostLkr += r.receivedCostLkr;
      summary.totalUsageCostLkr += r.usageCostLkr;
      summary.recordsCount++;
    }

    // Final calculations for calculated balance and status
    let totalReceivedCostLkr = 0;
    let totalUsageCostLkr = 0;
    let discrepancyItemsCount = 0;

    const itemSummaries = Array.from(itemMap.values()).map((item) => {
      item.calculatedBalanceQty = item.totalReceivedQty - item.totalUsageAndWastageQty - item.totalFaultyQty;
      item.netFinancialVarianceLkr = item.totalReceivedCostLkr - item.totalUsageCostLkr;

      if (item.calculatedBalanceQty < 0) {
        item.discrepancyStatus = 'DEFICIT';
        discrepancyItemsCount++;
      } else if (item.calculatedBalanceQty > 0) {
        item.discrepancyStatus = 'SURPLUS';
      } else {
        item.discrepancyStatus = 'BALANCED';
      }

      totalReceivedCostLkr += item.totalReceivedCostLkr;
      totalUsageCostLkr += item.totalUsageCostLkr;

      return item;
    });

    return {
      opmcId,
      totalReceivedCostLkr,
      totalUsageCostLkr,
      netDiscrepancyLkr: totalReceivedCostLkr - totalUsageCostLkr,
      itemsAuditedCount: itemSummaries.length,
      discrepancyItemsCount,
      itemSummaries,
    };
  }
}
