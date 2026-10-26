import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';

type VarianceStatus = 'UNDER' | 'ON_TRACK' | 'OVER' | 'CRITICAL' | 'UNKNOWN';

export interface ProjectCostSummaryInput {
  budget: number;
  expenseCost: number;
  laborCost: number;
  hasApprovedMaterialIssues: boolean;
}

/**
 * StockIssueItem deliberately does not carry an immutable unit-cost snapshot.
 * InventoryItem prices are mutable, so applying the current price to a past
 * issue would manufacture a financial value. Keep the project total unknown
 * until the stock issue flow records an auditable cost basis.
 */
export function calculateProjectCostSummary({
  budget,
  expenseCost,
  laborCost,
  hasApprovedMaterialIssues,
}: ProjectCostSummaryInput) {
  const knownActualCost = expenseCost + laborCost;

  if (hasApprovedMaterialIssues) {
    return {
      knownActualCost,
      materialCost: null,
      materialCostStatus: 'UNKNOWN' as const,
      actualCost: null,
      actualCostStatus: 'MATERIAL_COST_UNKNOWN' as const,
      variance: null,
      variancePct: null,
      varianceStatus: 'UNKNOWN' as const,
    };
  }

  const actualCost = knownActualCost;
  const variance = budget - actualCost;
  const variancePct = budget > 0 ? (variance / budget) * 100 : 0;

  return {
    knownActualCost,
    materialCost: 0,
    materialCostStatus: 'KNOWN' as const,
    actualCost,
    actualCostStatus: 'COMPLETE' as const,
    variance,
    variancePct,
    varianceStatus: BudgetTrackingService.getVarianceStatus(variancePct),
  };
}

export class BudgetTrackingService {
  /**
   * Initialize budget tracking when BOQ is approved
   */
  static async initializeBudget(projectId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { budget: true },
    });

    if (!project?.budget) return null;

    // Sync actualCost on initialization
    await BudgetTrackingService.syncActualCost(projectId);
    return project;
  }

  /**
   * Recalculate actualCost from all sources:
   * - Approved StockIssues, only when an immutable material-cost basis exists
   * - Approved ProjectExpenses
   * - DailyProgress labor costs
   */
  static async syncActualCost(projectId: string) {
    const [approvedMaterialIssue, expenseCost, laborCost, project] = await Promise.all([
      prisma.stockIssue.findFirst({
        where: { projectId, status: 'APPROVED' },
        select: { id: true },
      }),
      // Expense cost: sum of all project expenses
      prisma.projectExpense.aggregate({
        where: { projectId },
        _sum: { amount: true },
      }),
      // Labor cost from daily progress
      prisma.dailyProgress.aggregate({
        where: { projectId },
        _sum: { laborCost: true },
      }),
      prisma.project.findUnique({
        where: { id: projectId },
        select: { budget: true },
      }),
    ]);

    if (!project) throw AppError.badRequest('Project not found');

    const summary = calculateProjectCostSummary({
      budget: Number(project.budget ?? 0),
      expenseCost: Number(expenseCost._sum.amount ?? 0),
      laborCost: Number(laborCost._sum.laborCost ?? 0),
      hasApprovedMaterialIssues: Boolean(approvedMaterialIssue),
    });

    // Fail closed: do not overwrite a project total with a partial total when
    // approved materials have no immutable monetary value on the issue record.
    if (summary.actualCost === null) return summary;

    await prisma.project.update({
      where: { id: projectId },
      data: {
        actualCost: summary.actualCost,
        variance: summary.variance,
      },
    });

    return summary;
  }

  /**
   * Get comprehensive budget dashboard for a project
   */
  static async getBudgetDashboard(projectId: string) {
    const [project, materialIssues, expenses, dailyProgress, boqTotal] = await Promise.all([
      prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, name: true, budget: true, actualCost: true, variance: true },
      }),
      prisma.stockIssue.findMany({
        where: { projectId, status: 'APPROVED' },
        select: { id: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.projectExpense.findMany({
        where: { projectId },
        select: { amount: true, type: true, date: true },
        orderBy: { date: 'asc' },
      }),
      prisma.dailyProgress.findMany({
        where: { projectId },
        select: { laborCost: true, reportDate: true, progressPct: true },
        orderBy: { reportDate: 'asc' },
      }),
      prisma.projectBOQItem.aggregate({
        where: { projectId },
        _sum: { amount: true },
      }),
    ]);

    if (!project) throw AppError.badRequest('Project not found');

    const expenseCost = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const laborCost = dailyProgress.reduce((s, d) => s + Number(d.laborCost), 0);
    const budget = Number(project.budget ?? 0);
    const costSummary = calculateProjectCostSummary({
      budget,
      expenseCost,
      laborCost,
      hasApprovedMaterialIssues: materialIssues.length > 0,
    });
    const boqEstimate = Number(boqTotal._sum.amount ?? 0);

    // Known costs only; do not present this as a full actual-cost trend when
    // material cost is unknown.
    const knownMonthlyTrend: Record<string, number> = {};
    for (const exp of expenses) {
      const month = exp.date.toISOString().substring(0, 7);
      knownMonthlyTrend[month] = (knownMonthlyTrend[month] || 0) + Number(exp.amount);
    }
    for (const dp of dailyProgress) {
      const month = dp.reportDate.toISOString().substring(0, 7);
      knownMonthlyTrend[month] = (knownMonthlyTrend[month] || 0) + Number(dp.laborCost);
    }

    const knownMonthlyTrendEntries = Object.entries(knownMonthlyTrend)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, cost]) => ({ month, cost }));

    return {
      budget,
      boqEstimate,
      ...costSummary,
      expenseCost,
      laborCost,
      variancePct: costSummary.variancePct === null ? null : Math.abs(costSummary.variancePct),
      monthlyTrend: costSummary.actualCost === null ? [] : knownMonthlyTrendEntries,
      knownMonthlyTrend: knownMonthlyTrendEntries,
      monthlyTrendStatus: costSummary.actualCost === null ? 'MATERIAL_COST_UNKNOWN' : 'COMPLETE',
      progressPct: dailyProgress.at(-1)?.progressPct ?? project.actualCost,
    };
  }

  /**
   * Get variance status label based on % over/under budget
   */
  static getVarianceStatus(variancePct: number): VarianceStatus {
    if (variancePct >= 5) return 'UNDER';
    if (variancePct >= -5) return 'ON_TRACK';
    if (variancePct >= -20) return 'OVER';
    return 'CRITICAL';
  }
}
