import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { computeProjectCost, syncProjectActualCost } from '@/services/project/project-cost.service';
import type { TransactionClient } from '@/types/inventory/inventory-service.types';

type VarianceStatus = 'UNDER' | 'ON_TRACK' | 'OVER' | 'CRITICAL' | 'UNKNOWN';

export interface ProjectCostSummaryInput {
  budget: number;
  expenseCost: number;
  laborCost: number;
  hasApprovedMaterialIssues: boolean;
  /** Net material cost taken from the inventory ledger; when given (and the cost basis is known) it is included in the total. */
  materialCost?: number | null;
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
  materialCost,
}: ProjectCostSummaryInput) {
  const knownActualCost = expenseCost + laborCost;

  if (hasApprovedMaterialIssues && (materialCost === undefined || materialCost === null)) {
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

  const material = materialCost ?? 0;
  const actualCost = knownActualCost + material;
  const variance = budget - actualCost;
  const variancePct = budget > 0 ? (variance / budget) * 100 : 0;

  return {
    knownActualCost,
    materialCost: material,
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
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { budget: true } });
    if (!project) throw AppError.badRequest('Project not found');
    // Fail closed: a partial total is never stored while an approved material movement has no cost basis.
    const cost = await syncProjectActualCost(prisma as unknown as TransactionClient, projectId);
    return calculateProjectCostSummary({
      budget: Number(project.budget ?? 0),
      expenseCost: cost.expenseCost,
      laborCost: cost.laborCost,
      hasApprovedMaterialIssues: !cost.materialCostKnown,
      materialCost: cost.materialCostKnown ? cost.materialCost : null,
    });
  }

  /**
   * Get comprehensive budget dashboard for a project
   */
  static async getBudgetDashboard(projectId: string) {
    const [project, expenses, dailyProgress, boqTotal] = await Promise.all([
      prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, name: true, budget: true, actualCost: true, variance: true },
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
    const ledgerCost = await computeProjectCost(prisma as unknown as TransactionClient, projectId);
    const costSummary = calculateProjectCostSummary({
      budget,
      expenseCost,
      laborCost,
      hasApprovedMaterialIssues: !ledgerCost.materialCostKnown,
      materialCost: ledgerCost.materialCostKnown ? ledgerCost.materialCost : null,
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
