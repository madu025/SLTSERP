import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Params = Promise<{ id: string }>;

// GET /api/projects/[id]/close - Check if project can be closed
export async function GET(_request: Request, { params }: { params: Params }) {
  try {
    const { id: projectId } = await params;
    const userId = _request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Closure checklist
    const [
      project,
      patSessions,
      unpaidInvoices,
      openChangeRequests,
      pendingTasks,
      pendingExpenses,
      pendingReturns,
    ] = await Promise.all([
      prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, name: true, status: true, budget: true, actualCost: true },
      }),
      prisma.pATSession.count({
        where: { projectId, status: { notIn: ['COMPLETED'] } },
      }),
      prisma.projectInvoice.count({
        where: {
          projectId,
          status: { not: 'PAID' },
        },
      }),
      prisma.projectChangeRequest.count({
        where: { projectId, status: { in: ['DRAFT', 'SUBMITTED'] } },
      }),
      prisma.projectTask.count({
        where: { projectId, status: { not: 'COMPLETED' } },
      }),
      prisma.projectExpense.count({
        where: { projectId, status: 'PENDING_APPROVAL' },
      }),
      prisma.projectMaterialReturn.count({
        where: { projectId, status: 'PENDING' },
      }),
    ]);

    const checks = [
      {
        check: 'PAT Complete',
        passed: patSessions === 0,
        detail: patSessions > 0 ? `${patSessions} PAT sessions pending` : 'All PAT complete',
      },
      {
        check: 'Invoices Paid',
        passed: unpaidInvoices === 0,
        detail: unpaidInvoices > 0 ? `${unpaidInvoices} unpaid invoices` : 'All invoices paid',
      },
      {
        check: 'Change Requests Closed',
        passed: openChangeRequests === 0,
        detail: openChangeRequests > 0 ? `${openChangeRequests} open change requests` : 'No open CRs',
      },
      {
        check: 'Tasks Complete',
        passed: pendingTasks === 0,
        detail: pendingTasks > 0 ? `${pendingTasks} pending tasks` : 'All tasks complete',
      },
      {
        check: 'Expenses Approved',
        passed: pendingExpenses === 0,
        detail: pendingExpenses > 0 ? `${pendingExpenses} expenses pending approval` : 'All expenses processed',
      },
      {
        check: 'Returns Closed',
        passed: pendingReturns === 0,
        detail: pendingReturns > 0 ? `${pendingReturns} pending returns` : 'All returns resolved',
      },
    ];

    const allPassed = checks.every((c) => c.passed);

    return NextResponse.json({
      project: { id: project?.id, name: project?.name, status: project?.status },
      canClose: allPassed,
      checks,
      financial: {
        budget: project?.budget,
        actualCost: project?.actualCost,
        variance: project?.budget && project?.actualCost
          ? project.budget - project.actualCost
          : null,
      },
    });
  } catch (error) {
    console.error('Error checking closure:', error);
    return NextResponse.json({ error: 'Failed to check closure eligibility' }, { status: 500 });
  }
}

// POST /api/projects/[id]/close - Close the project
export async function POST(request: Request, { params }: { params: Params }) {
  try {
    const { id: projectId } = await params;
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { remarks, finalAsBuiltGenerated } = body;

    // Verify all checks pass (re-run validation)
    const openIssues = await Promise.all([
      prisma.pATSession.count({ where: { projectId, status: { notIn: ['COMPLETED'] } } }),
      prisma.projectInvoice.count({ where: { projectId, status: { not: 'PAID' } } }),
      prisma.projectChangeRequest.count({ where: { projectId, status: { in: ['DRAFT', 'SUBMITTED'] } } }),
      prisma.projectTask.count({ where: { projectId, status: { not: 'COMPLETED' } } }),
      prisma.projectExpense.count({ where: { projectId, status: 'PENDING_APPROVAL' } }),
    ]);

    const totalOpen = openIssues.reduce((sum, count) => sum + count, 0);
    if (totalOpen > 0) {
      return NextResponse.json(
        {
          error: `Cannot close: ${totalOpen} open items remain (PAT, invoices, CRs, tasks, expenses)`,
          openIssues: {
            patPending: openIssues[0],
            unpaidInvoices: openIssues[1],
            openChangeRequests: openIssues[2],
            pendingTasks: openIssues[3],
            pendingExpenses: openIssues[4],
          },
        },
        { status: 400 }
      );
    }

    // Close project
    const project = await prisma.project.update({
      where: { id: projectId },
      data: {
        status: 'COMPLETED',
        actualDuration: undefined, // Could calculate from startDate to now
      },
    });

    // Generate final as-built automatically
    if (finalAsBuiltGenerated !== false) {
      try {
        const { AsBuiltService } = await import('@/services/as-built.service');
        await AsBuiltService.generateQGIS(projectId);
      } catch (e) {
        console.warn('Final as-built generation skipped:', e);
      }
    }

    // Calculate final KPI for contractor
    if (project.contractorId) {
      try {
        const { ContractorKPIService } = await import('@/services/contractor-kpi.service');
        await ContractorKPIService.calculateMonthlyScore(
          project.contractorId,
          new Date().toISOString().substring(0, 7),
          projectId
        );
      } catch (e) {
        console.warn('Final KPI calculation skipped:', e);
      }
    }

    // Log closure in GIS audit
    await prisma.gISAuditLog.create({
      data: {
        projectId,
        entityType: 'PROJECT',
        entityId: projectId,
        action: 'CLOSED',
        performedById: userId,
        fieldChanges: { remarks, closedAt: new Date().toISOString() },
        source: 'PROJECT_CLOSURE',
      },
    });

    return NextResponse.json({
      message: 'Project closed successfully',
      project: { id: project.id, name: project.name, status: 'COMPLETED' },
      closedAt: new Date(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to close project';
    console.error('Project closure error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}