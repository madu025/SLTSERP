import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';

type VarianceStatus = 'UNDER' | 'ON_TRACK' | 'OVER' | 'CRITICAL';

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
   * - Approved StockIssues
   * - Approved ProjectExpenses
   * - DailyProgress labor costs
   */
  static async syncActualCost(projectId: string) {
    const [materialIssueItems, expenseCost, laborCost] = await Promise.all([
      // Material cost: sum of items in approved stock issues
      prisma.stockIssueItem.aggregate({
        where: {
          issue: {
            projectId,
            status: 'APPROVED',
          },
        },
        _sum: { quantity: true },
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
    ]);

    const totalActual =
      (materialIssueItems._sum.quantity ?? 0) + // qty as proxy; real cost needs unit price join
      (expenseCost._sum.amount ?? 0) +
      (laborCost._sum.laborCost ?? 0);

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { budget: true },
    });

    const budget = project?.budget ?? 0;
    const variance = budget - totalActual;
    const variancePct = budget > 0 ? (variance / budget) * 100 : 0;
    const varianceStatus = BudgetTrackingService.getVarianceStatus(variancePct);

    await prisma.project.update({
      where: { id: projectId },
      data: {
        actualCost: totalActual,
        variance,
      },
    });

    return {
      actualCost: totalActual,
      budget,
      variance,
      variancePct,
      varianceStatus,
    };
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

    const materialCost = materialIssues.reduce((s) => s + 0, 0); // No direct cost on StockIssue
    const expenseCost = expenses.reduce((s, e) => s + e.amount, 0);
    const laborCost = dailyProgress.reduce((s, d) => s + d.laborCost, 0);
    const actualCost = materialCost + expenseCost + laborCost;

    const budget = project.budget ?? 0;
    const variance = budget - actualCost;
    const variancePct = budget > 0 ? (variance / budget) * 100 : 0;
    const varianceStatus = BudgetTrackingService.getVarianceStatus(variancePct);
    const boqEstimate = boqTotal._sum.amount ?? 0;

    // Cost breakdown by month (for trend chart)
    const monthlyTrend: Record<string, number> = {};
    for (const issue of materialIssues) {
      const month = issue.createdAt.toISOString().substring(0, 7);
      monthlyTrend[month] = (monthlyTrend[month] || 0); // cost not available directly
    }
    for (const exp of expenses) {
      const month = exp.date.toISOString().substring(0, 7);
      monthlyTrend[month] = (monthlyTrend[month] || 0) + exp.amount;
    }
    for (const dp of dailyProgress) {
      const month = dp.reportDate.toISOString().substring(0, 7);
      monthlyTrend[month] = (monthlyTrend[month] || 0) + dp.laborCost;
    }

    return {
      budget,
      boqEstimate,
      actualCost,
      materialCost,
      expenseCost,
      laborCost,
      variance,
      variancePct: Math.abs(variancePct),
      varianceStatus,
      monthlyTrend: Object.entries(monthlyTrend)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, cost]) => ({ month, cost })),
      progressPct: dailyProgress.at(-1)?.progressPct ?? project.actualCost,
    };
  }

  /**
   * Get variance status label based on % over/under budget
   */
  private static getVarianceStatus(variancePct: number): VarianceStatus {
    if (variancePct >= 5) return 'UNDER';
    if (variancePct >= -5) return 'ON_TRACK';
    if (variancePct >= -20) return 'OVER';
    return 'CRITICAL';
  }
}
