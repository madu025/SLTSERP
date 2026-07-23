import { prisma } from '@/lib/prisma';
import {
  type CapexOpexSummary,
  type MonthlyTrendPoint,
  type BudgetVsActualItem,
  type SpendCategory,
  type ExpenditureType,
} from './capex-opex-types';
import { BudgetAllocationService } from './budget-allocation.service';
import { CapexOpexLedgerService } from './capex-opex-ledger.service';

// ─────────────────────────────────────────────────────────────────────────────
// CapexOpexDashboardService
// Aggregation layer for the executive CAPEX/OPEX dashboard.
// All aggregations are DB-side — no in-memory N² loops.
// ─────────────────────────────────────────────────────────────────────────────

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export class CapexOpexDashboardService {
  /**
   * Executive summary: CAPEX vs OPEX totals, variance, utilization, and alerts.
   * Reuses BudgetAllocationService.getBudgetVsActual (O(N/k + k)).
   */
  static async getExecutiveSummary(
    opmcId: string,
    fiscalYear: number,
    quarter?: number
  ): Promise<CapexOpexSummary> {
    const budgetVsActual = await BudgetAllocationService.getBudgetVsActual(
      opmcId,
      fiscalYear,
      quarter
    );

    // Aggregate CAPEX and OPEX totals — O(k) single pass
    let capexBudgeted = 0, capexActual = 0;
    let opexBudgeted = 0, opexActual = 0;
    const alerts: BudgetVsActualItem[] = [];

    for (const item of budgetVsActual) {
      if (item.expenditureType === 'CAPEX') {
        capexBudgeted += item.allocated;
        capexActual += item.actual;
      } else {
        opexBudgeted += item.allocated;
        opexActual += item.actual;
      }
      if (item.isAlert) alerts.push(item);
    }

    return {
      capex: {
        budgeted: capexBudgeted,
        actual: capexActual,
        variance: capexBudgeted - capexActual,
        utilizationPct: capexBudgeted > 0
          ? Math.round((capexActual / capexBudgeted) * 100)
          : 0,
      },
      opex: {
        budgeted: opexBudgeted,
        actual: opexActual,
        variance: opexBudgeted - opexActual,
        utilizationPct: opexBudgeted > 0
          ? Math.round((opexActual / opexBudgeted) * 100)
          : 0,
      },
      breakdown: budgetVsActual,
      alerts,
    };
  }

  /**
   * Monthly trend data for Recharts LineChart.
   * Returns 12 months of CAPEX + OPEX spend for the fiscal year.
   * O(N/12) DB GROUP BY, then O(12) in-memory map.
   */
  static async getMonthlyTrend(
    opmcId: string,
    fiscalYear: number
  ): Promise<MonthlyTrendPoint[]> {
    const monthlyTotals = await CapexOpexLedgerService.getMonthlyTotals(opmcId, fiscalYear);

    return monthlyTotals.map((m) => ({
      month: `${fiscalYear}-${String(m.month).padStart(2, '0')}`,
      label: `${MONTHS[m.month - 1]} ${fiscalYear}`,
      capex: m.capex,
      opex: m.opex,
    }));
  }

  /**
   * Category breakdown for donut/pie chart.
   * Returns spend split by category for one type (CAPEX or OPEX).
   * O(N/k) DB GROUP BY.
   */
  static async getCategoryBreakdown(
    opmcId: string,
    fiscalYear: number,
    expenditureType?: ExpenditureType
  ): Promise<{ category: SpendCategory; amount: number; expenditureType: ExpenditureType }[]> {
    const aggregated = await CapexOpexLedgerService.getAggregatedSpend(opmcId, fiscalYear);

    return aggregated
      .filter((a) => !expenditureType || a.expenditureType === expenditureType)
      .map((a) => ({
        category: a.category,
        amount: a.total,
        expenditureType: a.expenditureType,
      }));
  }

  /**
   * Top N expense items by amount for a given OPMC/FY.
   * O(log N) — DB ORDER BY amount DESC LIMIT N.
   */
  static async getTopExpenses(
    opmcId: string,
    fiscalYear: number,
    limit = 10
  ): Promise<{
    id: string;
    description: string;
    amount: number;
    category: SpendCategory;
    expenditureType: ExpenditureType;
    sourceType: string;
    transactionDate: Date;
    referenceNumber: string | null;
  }[]> {
    const rows = await prisma.capexOpexLedgerEntry.findMany({
      where: { opmcId, fiscalYear },
      select: {
        id: true,
        description: true,
        amount: true,
        category: true,
        expenditureType: true,
        sourceType: true,
        transactionDate: true,
        referenceNumber: true,
      },
      orderBy: { amount: 'desc' },
      take: limit,
    });

    return rows.map((r: { id: string; description: string; amount: number; category: string; expenditureType: string; sourceType: string; transactionDate: Date; referenceNumber: string | null }) => ({
      ...r,
      category: r.category as SpendCategory,
      expenditureType: r.expenditureType as ExpenditureType,
    }));
  }

  /**
   * Variance alerts: all budget lines exceeding the threshold.
   * Reuses BudgetAllocationService which already computes isAlert.
   * O(N/k + k).
   */
  static async getVarianceAlerts(
    opmcId: string,
    fiscalYear: number,
    thresholdPct = 90
  ): Promise<BudgetVsActualItem[]> {
    const items = await BudgetAllocationService.getBudgetVsActual(opmcId, fiscalYear);
    return items.filter((i) => i.utilizationPct >= thresholdPct);
  }

  /**
   * HQ-level summary across all OPMCs for a given fiscal year.
   * Returns a table suitable for the HO Finance dashboard.
   */
  static async getHqSummary(fiscalYear: number) {
    return BudgetAllocationService.getCrossOpmcSummary(fiscalYear);
  }

  /**
   * Quick KPI panel: CAPEX/OPEX ratio and quarterly burn rate.
   */
  static async getKpiPanel(
    opmcId: string,
    fiscalYear: number
  ): Promise<{
    capexRatio: number;
    opexRatio: number;
    totalSpend: number;
    avgMonthlyBurn: number;
    currentQuarterSpend: number;
  }> {
    const aggregated = await CapexOpexLedgerService.getAggregatedSpend(opmcId, fiscalYear);

    let capexTotal = 0, opexTotal = 0;
    for (const row of aggregated) {
      if (row.expenditureType === 'CAPEX') capexTotal += row.total;
      else opexTotal += row.total;
    }

    const totalSpend = capexTotal + opexTotal;

    // Current quarter
    const now = new Date();
    const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);
    const quarterAggregated = await CapexOpexLedgerService.getAggregatedSpend(
      opmcId,
      fiscalYear,
      currentQuarter
    );
    const currentQuarterSpend = quarterAggregated.reduce((sum, r) => sum + r.total, 0);

    // Months elapsed in fiscal year
    const monthsElapsed = now.getFullYear() === fiscalYear ? now.getMonth() + 1 : 12;

    return {
      capexRatio: totalSpend > 0 ? Math.round((capexTotal / totalSpend) * 100) : 0,
      opexRatio: totalSpend > 0 ? Math.round((opexTotal / totalSpend) * 100) : 0,
      totalSpend,
      avgMonthlyBurn: monthsElapsed > 0 ? Math.round(totalSpend / monthsElapsed) : 0,
      currentQuarterSpend,
    };
  }
}

const _: typeof CapexOpexDashboardService = CapexOpexDashboardService;
export default _;
