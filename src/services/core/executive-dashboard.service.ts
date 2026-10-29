import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { NIL_UUID } from '@/lib/opmc-scope';

type Scope = {
  opmcIds?: string[];
  projectIds: string[];
};

const TERMINAL_REVIEW_STATUSES = ['APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED'];
const TERMINAL_CHANGE_STATUSES = ['APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED'];
const TERMINAL_INVOICE_STATUSES = ['COMPLETED', 'FULLY_PAID', 'PAID', 'CANCELLED'];
const AS_BUILT_CATEGORIES = ['AS_BUILT', 'AS_BUILT_CAD', 'CAD_AS_BUILT', 'QGIS_AS_BUILT'];

export class ExecutiveDashboardService {
  /**
   * Executive Control Tower data. Every project-owned metric is derived from
   * the same project scope resolved by the API route. This method is read-only
   * and deliberately reports unknown coverage instead of manufacturing values.
   */
  static async getDashboardData(opmcIds?: string[]) {
    const asOf = new Date();
    const projectWhere: Prisma.ProjectWhereInput = opmcIds === undefined
      ? {}
      : { opmcId: opmcIds.length > 0 ? { in: opmcIds } : NIL_UUID };

    const scopedProjects = await prisma.project.findMany({
      where: projectWhere,
      select: { id: true },
    });
    const scope: Scope = { opmcIds, projectIds: scopedProjects.map((project) => project.id) };

    const [projectStats, budgetStats, patStats, contractorRankings, recentActivity, controlTower] = await Promise.all([
      ExecutiveDashboardService.getProjectStats(projectWhere),
      ExecutiveDashboardService.getBudgetStats(projectWhere),
      ExecutiveDashboardService.getPATStats(scope),
      ExecutiveDashboardService.getContractorRankings(scope),
      ExecutiveDashboardService.getRecentActivity(scope),
      ExecutiveDashboardService.getControlTower(scope, asOf),
    ]);

    return {
      projectStats,
      budgetStats,
      patStats,
      contractorRankings,
      recentActivity,
      controlTower,
      // Keep the legacy timestamp while exposing an explicit API freshness
      // contract for consumers that need to show an "as of" indicator.
      generatedAt: asOf,
      asOf,
      updatedAt: asOf,
      dataQuality: {
        updatedAtDefinition: 'Timestamp when this response was assembled; source rows retain their own updatedAt fields.',
        scope: opmcIds === undefined ? 'GLOBAL' : 'OPMC',
        opmcIds: opmcIds ?? null,
        projectCount: scope.projectIds.length,
        notes: [
          'All project-owned metrics are restricted to the resolved OPMC scope.',
          'Budget, actual cost, PAT, material, document, invoice, risk and change-request values are stored fields; no estimates are substituted.',
          'Task blocked count means tasks explicitly marked BLOCKED; dependency-derived blockers are not inferred.',
        ],
      },
    };
  }

  private static async getProjectStats(where: Prisma.ProjectWhereInput) {
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

    const countFor = (status: string) => byStatus.find((item) => item.status === status)?._count.id ?? 0;
    const completed = countFor('COMPLETED');
    const cancelled = countFor('CANCELLED');
    const active = Math.max(0, total - completed - cancelled);
    const completionDenominator = Math.max(0, total - cancelled);

    return {
      total,
      // Active is every non-terminal project, including planning, BOQ and
      // hold states. Counting only IN_PROGRESS hid work waiting at gates.
      active,
      delayed: countFor('DELAYED'),
      completed,
      planning: countFor('PLANNING'),
      cancelled,
      completionRate: completionDenominator > 0 ? Math.round((completed / completionDenominator) * 100) : 0,
      byStatus: byStatus.map((item) => ({ status: item.status, count: item._count.id })),
      byType: byType.map((item) => ({ type: item.type, count: item._count.id })),
    };
  }

  private static async getBudgetStats(where: Prisma.ProjectWhereInput) {
    const [stats, overBudget] = await Promise.all([
      prisma.project.aggregate({
        where,
        _sum: { budget: true, actualCost: true, variance: true },
        _avg: { progress: true },
      }),
      prisma.project.count({
        where: { ...where, variance: { lt: 0 } },
      }),
    ]);

    const totalBudget = Number(stats._sum.budget ?? 0);
    const totalSpent = Number(stats._sum.actualCost ?? 0);
    const totalVariance = Number(stats._sum.variance ?? 0);

    return {
      totalBudget,
      totalSpent,
      totalVariance,
      spendRate: totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0,
      overBudgetProjects: overBudget,
      avgProgress: Math.round(Number(stats._avg.progress ?? 0) * 10) / 10,
      definitions: {
        variance: 'Project.variance as stored by the project cost workflow; no fallback is calculated here.',
        overBudget: 'Project.variance < 0.',
        progress: 'Average Project.progress across scoped projects.',
      },
    };
  }

  private static async getPATStats(scope: Scope) {
    const projectScope: Prisma.PATSessionWhereInput = { projectId: { in: scope.projectIds } };
    const terminalScope: Prisma.PATSessionWhereInput = {
      ...projectScope,
      status: { in: ['COMPLETED', 'FAILED'] },
    };
    const [sessionCount, statusGroups, terminalTypeGroups, terminalStats] = await Promise.all([
      prisma.pATSession.count({ where: projectScope }),
      prisma.pATSession.groupBy({
        by: ['status'],
        where: projectScope,
        _count: { _all: true },
      }),
      prisma.pATSession.groupBy({
        by: ['patType'],
        where: terminalScope,
        _count: { _all: true },
      }),
      prisma.pATSession.aggregate({
        where: terminalScope,
        _avg: { passRate: true },
      }),
    ]);

    const countForStatus = (status: string) =>
      statusGroups.find((group) => group.status === status)?._count._all ?? 0;
    const completed = countForStatus('COMPLETED');
    const failed = countForStatus('FAILED');
    const cancelled = countForStatus('CANCELLED');
    const total = completed + failed;
    const prePATCount = terminalTypeGroups.find((group) => group.patType === 'PRE_PAT')?._count._all ?? 0;
    const sltPATCount = terminalTypeGroups.find((group) => group.patType === 'SLT_PAT')?._count._all ?? 0;
    const avgPassRate = terminalStats._avg.passRate === null
      ? null
      : Number(terminalStats._avg.passRate);

    return {
      // Keep the legacy terminal-session semantics for existing consumers;
      // sessionCount/open expose the broader control-tower view.
      total,
      sessionCount,
      completed,
      passed: completed,
      failed,
      open: Math.max(0, sessionCount - total - cancelled),
      passRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      avgPassRate: avgPassRate === null ? null : Math.round(avgPassRate),
      prePATCount,
      sltPATCount,
      definitions: {
        completed: "PATSession.status = 'COMPLETED'.",
        failed: "PATSession.status = 'FAILED'.",
        passRate: 'Completed terminal sessions / terminal PAT sessions; average pass rate excludes null stored values.',
      },
    };
  }

  private static async getContractorRankings(scope: Scope) {
    const where: Prisma.ContractorPerformanceScoreWhereInput = scope.opmcIds === undefined
      ? {}
      : { projectId: { in: scope.projectIds } };
    const scores = await prisma.contractorPerformanceScore.findMany({
      where,
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

    return scores.map((item, index) => ({
      rank: index + 1,
      name: item.contractor.name,
      score: Number(item.score),
      qualityScore: item.qualityScore === null ? null : Number(item.qualityScore),
      safetyScore: item.safetyScore === null ? null : Number(item.safetyScore),
      scheduleScore: item.scheduleScore === null ? null : Number(item.scheduleScore),
      patPassPct: item.patPassPct === null ? null : Number(item.patPassPct),
      hseIncidents: item.hseIncidentCount,
      month: item.evaluationMonth,
    }));
  }

  private static async getRecentActivity(scope: Scope) {
    const predictionWhere: Prisma.AiPredictionWhereInput = {
      riskLevel: { in: ['HIGH', 'CRITICAL'] },
      isResolved: false,
      ...(scope.opmcIds === undefined ? {} : { projectId: { in: scope.projectIds } }),
    };
    const [recentProjects, recentPAT, highRiskPredictions] = await Promise.all([
      prisma.project.findMany({
        where: { id: { in: scope.projectIds } },
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
        where: { projectId: { in: scope.projectIds } },
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
        where: predictionWhere,
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

  private static async getControlTower(scope: Scope, asOf: Date) {
    const projectIds = scope.projectIds;
    const projectIdWhere = { in: projectIds };
    const openTaskWhere: Prisma.ProjectTaskWhereInput = {
      projectId: projectIdWhere,
      status: { notIn: ['COMPLETED', 'CANCELLED'] },
    };
    const overdueTaskWhere: Prisma.ProjectTaskWhereInput = {
      ...openTaskWhere,
      plannedEndDate: { lt: asOf },
    };

    const [
      totalTasks,
      openTasks,
      overdueTasks,
      blockedTasks,
      criticalOpenTasks,
      approvalBacklog,
      stageApprovalBacklog,
      pendingReviews,
      reworkReviews,
      pendingHandoffs,
      materialStats,
      shortageRequirementCount,
      patCloseout,
      documentCloseout,
      invoiceCloseout,
      invoiceOpenCount,
      openRiskCount,
      riskStats,
      changeStats,
    ] = await Promise.all([
      prisma.projectTask.count({ where: { projectId: projectIdWhere } }),
      prisma.projectTask.count({ where: openTaskWhere }),
      prisma.projectTask.count({ where: overdueTaskWhere }),
      prisma.projectTask.count({ where: { ...openTaskWhere, status: 'BLOCKED' } }),
      prisma.projectTask.count({ where: { ...openTaskWhere, isCritical: true } }),
      prisma.projectApprovalRequest.count({
        where: { projectId: projectIdWhere, status: { notIn: TERMINAL_REVIEW_STATUSES } },
      }),
      prisma.projectApprovalInstance.count({
        where: { stage: { projectWorkflowInstance: { projectId: projectIdWhere } }, status: { notIn: TERMINAL_REVIEW_STATUSES } },
      }),
      prisma.workflowReviewCycle.count({
        where: { projectId: projectIdWhere, status: { in: ['SUBMITTED', 'IN_REVIEW', 'PENDING'] } },
      }),
      prisma.workflowReviewCycle.count({
        where: { projectId: projectIdWhere, status: { in: ['REWORK', 'CHANGES_REQUIRED', 'REVISION_REQUIRED'] } },
      }),
      prisma.workflowHandoff.count({
        where: { projectId: projectIdWhere, status: { notIn: TERMINAL_REVIEW_STATUSES } },
      }),
      prisma.projectMaterialRequirement.aggregate({
        where: { projectId: projectIdWhere },
        _count: { id: true },
        _sum: { requiredQty: true, reservedQty: true, issuedQty: true, shortageQty: true },
      }),
      prisma.projectMaterialRequirement.count({
        where: { projectId: projectIdWhere, shortageQty: { gt: 0 } },
      }),
      prisma.pATSession.groupBy({
        by: ['status'],
        where: { projectId: projectIdWhere },
        _count: { id: true },
      }),
      prisma.projectDocument.groupBy({
        by: ['status'],
        where: { projectId: projectIdWhere, category: { in: AS_BUILT_CATEGORIES } },
        _count: { id: true },
      }),
      prisma.projectInvoice.aggregate({
        where: { projectId: projectIdWhere },
        _count: { id: true },
        _sum: { totalAmount: true, paidAmount: true, balanceAmount: true },
      }),
      prisma.projectInvoice.count({
        where: {
          projectId: projectIdWhere,
          status: { notIn: TERMINAL_INVOICE_STATUSES },
        },
      }),
      prisma.projectRisk.count({
        where: { projectId: projectIdWhere, status: { notIn: ['RESOLVED', 'CLOSED', 'CANCELLED'] } },
      }),
      prisma.projectRisk.findMany({
        where: { projectId: projectIdWhere, status: { notIn: ['RESOLVED', 'CLOSED', 'CANCELLED'] } },
        orderBy: [{ score: 'desc' }, { updatedAt: 'desc' }],
        take: 10,
        select: {
          id: true,
          projectId: true,
          title: true,
          description: true,
          probability: true,
          impact: true,
          score: true,
          status: true,
          mitigationPlan: true,
          updatedAt: true,
          project: { select: { projectCode: true, name: true } },
        },
      }),
      prisma.projectChangeRequest.groupBy({
        by: ['status'],
        where: { projectId: projectIdWhere },
        _count: { id: true },
      }),
    ]);

    const material = {
      requiredQty: Number(materialStats._sum.requiredQty ?? 0),
      reservedQty: Number(materialStats._sum.reservedQty ?? 0),
      issuedQty: Number(materialStats._sum.issuedQty ?? 0),
      shortageQty: Number(materialStats._sum.shortageQty ?? 0),
      requirementCount: materialStats._count.id,
      shortageRequirementCount,
      available: true,
      definitions: {
        quantities: 'Sums of ProjectMaterialRequirement.requiredQty, reservedQty, issuedQty and shortageQty.',
        shortageRequirementCount: 'ProjectMaterialRequirement.shortageQty > 0.',
      },
    };

    const countByStatus = (rows: Array<{ status: string; _count: { id: number } }>, status: string) =>
      rows.find((row) => row.status === status)?._count.id ?? 0;
    const patCompleted = countByStatus(patCloseout, 'COMPLETED');
    const asBuiltApproved = countByStatus(documentCloseout, 'APPROVED');
    const asBuiltTotal = documentCloseout.reduce((sum, row) => sum + row._count.id, 0);
    const invoiceTotal = Number(invoiceCloseout._sum.totalAmount ?? 0);
    const invoicePaid = Number(invoiceCloseout._sum.paidAmount ?? 0);
    const invoiceBalance = Number(invoiceCloseout._sum.balanceAmount ?? 0);
    const openChangeRequests = changeStats
      .filter((row) => !TERMINAL_CHANGE_STATUSES.includes(row.status))
      .reduce((sum, row) => sum + row._count.id, 0);

    return {
      asOf,
      workflow: {
        tasks: {
          total: totalTasks,
          open: openTasks,
          overdue: overdueTasks,
          blocked: blockedTasks,
          criticalOpen: criticalOpenTasks,
        },
        approvals: {
          projectRequestsOpen: approvalBacklog,
          stageApprovalsOpen: stageApprovalBacklog,
          reviewsPending: pendingReviews,
          reviewsRework: reworkReviews,
          handoffsPending: pendingHandoffs,
          definitions: {
            open: 'Non-terminal records; terminal statuses are APPROVED, REJECTED, CANCELLED and COMPLETED.',
            rework: 'WorkflowReviewCycle status in REWORK, CHANGES_REQUIRED or REVISION_REQUIRED.',
          },
        },
      },
      materials: material,
      closeout: {
        pat: {
          completed: patCompleted,
          failed: countByStatus(patCloseout, 'FAILED'),
          open: patCloseout.filter((row) => !['COMPLETED', 'FAILED', 'CANCELLED'].includes(row.status))
            .reduce((sum, row) => sum + row._count.id, 0),
          definitions: { completed: "PATSession.status = 'COMPLETED'." },
        },
        asBuilt: {
          totalDocuments: asBuiltTotal,
          approvedDocuments: asBuiltApproved,
          pendingDocuments: Math.max(0, asBuiltTotal - asBuiltApproved),
          categories: AS_BUILT_CATEGORIES,
          definitions: { approved: "ProjectDocument.category in the listed as-built categories and status = 'APPROVED'." },
        },
        invoices: {
          count: invoiceCloseout._count.id,
          totalAmount: invoiceTotal,
          paidAmount: invoicePaid,
          balanceAmount: invoiceBalance,
          openCount: invoiceOpenCount,
          definitions: {
            balance: 'Sum of ProjectInvoice.balanceAmount.',
            openCount: `ProjectInvoice.status not in ${TERMINAL_INVOICE_STATUSES.join(', ')}.`,
          },
        },
      },
      risks: {
        openCount: openRiskCount,
        topActionable: riskStats.map((risk) => ({
          id: risk.id,
          projectId: risk.projectId,
          projectCode: risk.project.projectCode,
          projectName: risk.project.name,
          title: risk.title,
          description: risk.description,
          probability: risk.probability,
          impact: risk.impact,
          score: risk.score,
          status: risk.status,
          mitigationPlan: risk.mitigationPlan,
          updatedAt: risk.updatedAt,
        })),
        note: 'Top actionable risks are the highest-score non-terminal risks, limited to 10 records.',
      },
      changeRequests: {
        byStatus: changeStats.map((row) => ({ status: row.status, count: row._count.id })),
        openCount: openChangeRequests,
      },
      coverage: {
        projectCount: projectIds.length,
        projectOwnedMetrics: true,
        materialRequirements: true,
        workflowInstances: true,
        asBuiltDocuments: true,
        projectInvoices: true,
        risks: true,
        changeRequests: true,
        unknown: [
          'Dependency-derived task blockers are not inferred.',
          'Cash, bank reconciliation, and accounting profit are not included because those ledgers are outside this endpoint scope.',
        ],
      },
    };
  }
}
