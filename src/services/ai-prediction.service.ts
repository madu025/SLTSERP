import { prisma } from '@/lib/prisma';

export class AiPredictionService {
  /**
   * Predict delay risk for a project
   */
  static async predictDelay(projectId: string) {
    const [project, tasks, dailyProgress, materialIssues] = await Promise.all([
      prisma.project.findUnique({
        where: { id: projectId },
        select: { startDate: true, endDate: true, progress: true, status: true },
      }),
      prisma.projectTask.findMany({
        where: { projectId, status: { in: ['PENDING', 'IN_PROGRESS', 'DELAYED'] } },
        select: { plannedEndDate: true, status: true, priority: true },
      }),
      prisma.dailyProgress.findMany({
        where: { projectId },
        select: { reportDate: true, progressPct: true },
        orderBy: { reportDate: 'desc' },
        take: 7,
      }),
      prisma.stockIssue.count({
        where: { projectId, status: 'PENDING' },
      }),
    ]);

    if (!project) throw new Error('Project not found');

    // Calculate delay indicators
    const overdueTasks = tasks.filter(
      (t) => t.plannedEndDate && t.plannedEndDate < new Date()
    ).length;
    const criticalOverdue = tasks.filter(
      (t) => t.priority === 'CRITICAL' && t.plannedEndDate && t.plannedEndDate < new Date()
    ).length;

    // Progress velocity (% per day over last 7 days)
    const velocityScore = dailyProgress.length >= 2
      ? (dailyProgress[0].progressPct - dailyProgress[dailyProgress.length - 1].progressPct) /
        dailyProgress.length
      : 0;

    // Risk factors
    const riskScore = Math.min(
      100,
      overdueTasks * 5 +
        criticalOverdue * 15 +
        materialIssues * 3 +
        (velocityScore < 0.5 ? 20 : 0)
    );

    const probabilityPct = Math.min(99, riskScore);
    const riskLevel =
      riskScore >= 70 ? 'CRITICAL' :
      riskScore >= 50 ? 'HIGH' :
      riskScore >= 30 ? 'MEDIUM' : 'LOW';

    const weeksDelay = Math.ceil(overdueTasks / 5);
    const predictedImpact = weeksDelay > 0 ? `${weeksDelay} week delay` : 'On schedule';

    const rootCause = [
      overdueTasks > 0 && `${overdueTasks} overdue tasks`,
      materialIssues > 0 && `${materialIssues} pending material issues`,
      velocityScore < 0.5 && 'Low progress velocity',
    ].filter(Boolean).join('; ');

    const recommendation = riskScore >= 50
      ? 'Expedite overdue tasks, resolve material bottlenecks, increase team size'
      : 'Monitor progress daily and address any emerging blockers';

    return prisma.aiPrediction.create({
      data: {
        projectId,
        predictionType: 'DELAY',
        riskLevel,
        probabilityPct,
        predictedImpact,
        currentMetrics: { overdueTasks, criticalOverdue, velocityScore, pendingMaterials: materialIssues } as object,
        rootCause,
        recommendation,
        confidenceScore: 72,
      },
    });
  }

  /**
   * Predict budget overrun risk
   */
  static async predictBudgetOverrun(projectId: string) {
    const [project, changeRequests] = await Promise.all([
      prisma.project.findUnique({
        where: { id: projectId },
        select: { budget: true, actualCost: true, variance: true, progress: true },
      }),
      prisma.projectChangeRequest.count({
        where: { projectId, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
      }),
    ]);

    if (!project) throw new Error('Project not found');

    const budget = project.budget ?? 0;
    const actual = project.actualCost;
    const progress = project.progress;

    if (budget === 0) {
      return prisma.aiPrediction.create({
        data: {
          projectId,
          predictionType: 'BUDGET_OVERRUN',
          riskLevel: 'LOW',
          probabilityPct: 0,
          predictedImpact: 'No budget set',
          currentMetrics: {} as object,
          confidenceScore: 50,
        },
      });
    }

    // Forecast total cost based on current burn rate
    const burnRate = progress > 0 ? actual / (progress / 100) : actual;
    const forecastOverrun = burnRate - budget;
    const overrunPct = (forecastOverrun / budget) * 100;

    const riskScore = Math.min(
      100,
      Math.max(0, overrunPct) * 2 + changeRequests * 10
    );

    const riskLevel =
      riskScore >= 70 ? 'CRITICAL' :
      riskScore >= 50 ? 'HIGH' :
      riskScore >= 30 ? 'MEDIUM' : 'LOW';

    const formattedOverrun = new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency: 'LKR',
      minimumFractionDigits: 0,
    }).format(Math.abs(forecastOverrun));

    return prisma.aiPrediction.create({
      data: {
        projectId,
        predictionType: 'BUDGET_OVERRUN',
        riskLevel,
        probabilityPct: Math.min(99, riskScore),
        predictedImpact: forecastOverrun > 0 ? `${formattedOverrun} overrun projected` : 'Within budget',
        currentMetrics: {
          budget,
          actualCost: actual,
          burnRate,
          forecastTotal: burnRate,
          pendingChangeRequests: changeRequests,
        } as object,
        rootCause: overrunPct > 10
          ? `Burn rate ${Math.round(overrunPct)}% above budget; ${changeRequests} pending change requests`
          : 'Spend on track',
        recommendation: overrunPct > 10
          ? 'Review change requests, identify cost reduction opportunities'
          : 'Continue monitoring spend rate',
        confidenceScore: 68,
      },
    });
  }

  /**
   * Predict permit delay risk
   */
  static async predictPermitDelay(projectId: string) {
    const pendingPermits = await prisma.projectPermit.findMany({
      where: {
        projectId,
        status: { notIn: ['APPROVED', 'OBTAINED'] },
      },
      select: { id: true, submittedDate: true, status: true, permitType: true },
    });

    if (pendingPermits.length === 0) {
      return prisma.aiPrediction.create({
        data: {
          projectId,
          predictionType: 'PERMIT_DELAY',
          riskLevel: 'LOW',
          probabilityPct: 5,
          predictedImpact: 'No pending permits',
          currentMetrics: { pendingPermits: 0 } as object,
          confidenceScore: 90,
        },
      });
    }

    const now = new Date();
    const SLA_DAYS = 30;
    const maxPending = pendingPermits.reduce((max, p) => {
      const days = p.submittedDate
        ? Math.floor((now.getTime() - new Date(p.submittedDate).getTime()) / 86400000)
        : 0;
      return Math.max(max, days);
    }, 0);

    const riskScore = Math.min(100, (maxPending / SLA_DAYS) * 100);

    const riskLevel =
      riskScore >= 80 ? 'CRITICAL' :
      riskScore >= 60 ? 'HIGH' :
      riskScore >= 40 ? 'MEDIUM' : 'LOW';

    const weeksOverSLA = Math.max(0, Math.ceil((maxPending - SLA_DAYS) / 7));

    return prisma.aiPrediction.create({
      data: {
        projectId,
        predictionType: 'PERMIT_DELAY',
        riskLevel,
        probabilityPct: Math.min(99, riskScore),
        predictedImpact: weeksOverSLA > 0
          ? `${weeksOverSLA} week delay from permit bottleneck`
          : 'Permits within SLA',
        currentMetrics: {
          pendingPermits: pendingPermits.length,
          maxDaysPending: maxPending,
          slaDays: SLA_DAYS,
        } as object,
        rootCause: `${pendingPermits.length} permit(s) pending for up to ${maxPending} days (SLA: ${SLA_DAYS} days)`,
        recommendation: maxPending > SLA_DAYS
          ? 'Escalate permit applications to relevant authority, prepare alternative work sequences'
          : 'Follow up with permit authorities',
        confidenceScore: 85,
      },
    });
  }

  /**
   * Predict material shortage across all active projects
   */
  static async predictMaterialShortage() {
    // Get all active project BOQ items
    const boqDemand = await prisma.projectBOQItem.groupBy({
      by: ['materialId'],
      where: {
        project: { status: { in: ['PLANNING', 'IN_PROGRESS', 'APPROVED'] } },
        materialId: { not: null },
      },
      _sum: { quantity: true, actualQuantity: true },
    });

    const materialIds = boqDemand.map(d => d.materialId).filter(Boolean) as string[];

    // Batch query stock levels for all demanded materials in a single query
    const stockLevels = await prisma.inventoryStock.groupBy({
      by: ['itemId'],
      where: { itemId: { in: materialIds } },
      _sum: { quantity: true },
    });

    const stockMap = new Map<string, number>();
    for (const stock of stockLevels) {
      if (stock.itemId) {
        stockMap.set(stock.itemId, stock._sum.quantity ? Number(stock._sum.quantity) : 0);
      }
    }

    const predictions = [];
    for (const demand of boqDemand) {
      if (!demand.materialId) continue;

      const required = (demand._sum.quantity ?? 0) - (demand._sum.actualQuantity ?? 0);
      const available = stockMap.get(demand.materialId) ?? 0;
      const shortfall = required - available;

      if (shortfall > 0) {
        const riskLevel = shortfall > required * 0.5 ? 'CRITICAL' : shortfall > required * 0.2 ? 'HIGH' : 'MEDIUM';
        predictions.push(
          prisma.aiPrediction.create({
            data: {
              predictionType: 'MATERIAL_SHORTAGE',
              riskLevel,
              probabilityPct: Math.min(99, (shortfall / required) * 100),
              predictedImpact: `${Math.round(shortfall)} units shortfall`,
              currentMetrics: {
                materialId: demand.materialId,
                required,
                available,
                shortfall,
              } as object,
              rootCause: `Stock insufficient for active project demand`,
              recommendation: `Raise Purchase Request for ${Math.ceil(shortfall * 1.1)} units (10% buffer)`,
              confidenceScore: 80,
            },
          })
        );
      }
    }

    return Promise.all(predictions);
  }

  /**
   * Get all predictions for a project
   */
  static async getAllPredictions(projectId: string) {
    return Promise.all([
      AiPredictionService.predictDelay(projectId),
      AiPredictionService.predictBudgetOverrun(projectId),
      AiPredictionService.predictPermitDelay(projectId),
    ]);
  }

  /**
   * Get saved predictions for a project (without re-running)
   */
  static async getSavedPredictions(projectId: string) {
    return prisma.aiPrediction.findMany({
      where: { projectId, isResolved: false },
      orderBy: [{ riskLevel: 'desc' }, { createdAt: 'desc' }],
    });
  }
}
