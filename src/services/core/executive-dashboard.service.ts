import { prisma } from '@/lib/prisma';

export class ExecutiveDashboardService {
  /**
   * Full executive dashboard data for CEO/Director view
   */
  static async getDashboardData(opmcIds?: string[]) {
    const projectWhere = opmcIds?.length ? { opmcId: { in: opmcIds } } : {};

    const [
      projectStats,
      budgetStats,
      patStats,
      contractorRankings,
      recentActivity,
    ] = await Promise.all([
      ExecutiveDashboardService.getProjectStats(projectWhere),
      ExecutiveDashboardService.getBudgetStats(projectWhere),
      ExecutiveDashboardService.getPATStats(projectWhere),
      ExecutiveDashboardService.getContractorRankings(),
      ExecutiveDashboardService.getRecentActivity(projectWhere),
    ]);

    return {
      projectStats,
      budgetStats,
      patStats,
      contractorRankings,
      recentActivity,
      generatedAt: new Date(),
    };
  }

  private static async getProjectStats(where: Record<string, unknown>) {
    const [total, byStatus, byType] = await Promise.all([
      prisma.project.count({ where }),
      prisma.project.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
      }),
      prisma.project.groupBy({
        by: ['type'],
        where,
        _count: { id: true },
      }),
    ]);

    const active = byStatus.find((s) => s.status === 'IN_PROGRESS')?._count.id ?? 0;
    const delayed = byStatus.find((s) => s.status === 'DELAYED')?._count.id ?? 0;
    const completed = byStatus.find((s) => s.status === 'COMPLETED')?._count.id ?? 0;
    const planning = byStatus.find((s) => s.status === 'PLANNING')?._count.id ?? 0;

    return {
      total,
      active,
      delayed,
      completed,
      planning,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count.id })),
      byType: byType.map((t) => ({ type: t.type, count: t._count.id })),
    };
  }

  private static async getBudgetStats(where: Record<string, unknown>) {
    const stats = await prisma.project.aggregate({
      where,
      _sum: { budget: true, actualCost: true, variance: true },
      _avg: { progress: true },
    });

    const totalBudget = stats._sum.budget ?? 0;
    const totalSpent = stats._sum.actualCost ?? 0;
    const totalVariance = stats._sum.variance ?? 0;

    // Over-budget projects
    const overBudget = await prisma.project.count({
      where: {
        ...where,
        variance: { lt: 0 },
      },
    });

    return {
      totalBudget,
      totalSpent,
      totalVariance,
      spendRate: totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0,
      overBudgetProjects: overBudget,
      avgProgress: Math.round((stats._avg.progress ?? 0) * 10) / 10,
    };
  }

  private static async getPATStats(where: Record<string, unknown>) {
    const patSessions = await prisma.pATSession.findMany({
      where: {
        project: where as Record<string, unknown>,
        status: { in: ['COMPLETED', 'FAILED'] },
      },
      select: { status: true, patType: true, passRate: true },
    });

    const total = patSessions.length;
    const passed = patSessions.filter((s) => s.status === 'COMPLETED').length;
    const prePAT = patSessions.filter((s) => s.patType === 'PRE_PAT');
    const sltPAT = patSessions.filter((s) => s.patType === 'SLT_PAT');
    const avgPassRate = total > 0
      ? patSessions.reduce((sum, s) => sum + (s.passRate ?? 0), 0) / total
      : 0;

    return {
      total,
      passed,
      failed: total - passed,
      passRate: total > 0 ? Math.round((passed / total) * 100) : 0,
      avgPassRate: Math.round(avgPassRate),
      prePATCount: prePAT.length,
      sltPATCount: sltPAT.length,
    };
  }

  private static async getContractorRankings() {
    const scores = await prisma.contractorPerformanceScore.findMany({
      distinct: ['contractorId'],
      orderBy: [{ evaluationMonth: 'desc' }, { score: 'desc' }],
      take: 10,
      select: {
        contractorId: true,
        evaluationMonth: true,
        score: true,
        qualityScore: true,
        safetyScore: true,
        scheduleScore: true,
        patPassPct: true,
        hseIncidentCount: true,
        contractor: { select: { name: true } },
      },
    });

    return scores.map((item, i) => ({
      rank: i + 1,
      name: item.contractor.name,
      score: item.score,
      qualityScore: item.qualityScore,
      safetyScore: item.safetyScore,
      scheduleScore: item.scheduleScore,
      patPassPct: item.patPassPct,
      hseIncidents: item.hseIncidentCount,
      month: item.evaluationMonth,
    }));
  }

  private static async getRecentActivity(where: Record<string, unknown>) {
    const [recentProjects, recentPAT, highRiskPredictions] = await Promise.all([
      prisma.project.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          name: true,
          status: true,
          progress: true,
          updatedAt: true,
          opmc: { select: { name: true } },
        },
      }),
      prisma.pATSession.findMany({
        where: {
          project: where as Record<string, unknown>,
        },
        orderBy: { completedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          patType: true,
          status: true,
          passRate: true,
          completedAt: true,
          project: { select: { name: true } },
        },
      }),
      prisma.aiPrediction.findMany({
        where: {
          riskLevel: { in: ['HIGH', 'CRITICAL'] },
          isResolved: false,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          predictionType: true,
          riskLevel: true,
          predictedImpact: true,
          recommendation: true,
          project: { select: { id: true, name: true } },
        },
      }),
    ]);

    return { recentProjects, recentPAT, highRiskPredictions };
  }
}
