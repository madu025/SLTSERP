import { NextResponse } from 'next/server';
import { ContractorKPIService } from '@/services/contractor-kpi.service';
import { prisma } from '@/lib/prisma';

type Params = Promise<{ id: string }>;

// GET /api/projects/[id]/contractor-kpi - Get contractor KPI scores for this project
export async function GET(_request: Request, { params }: { params: Params }) {
  try {
    const { id: projectId } = await params;
    const userId = _request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Get project contractor
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        contractorId: true,
        contractor: { select: { id: true, name: true, contactNumber: true } },
      },
    });

    if (!project || !project.contractorId) {
      return NextResponse.json({ error: 'No contractor assigned to this project' }, { status: 404 });
    }

    // Get all KPI scores for this contractor
    const scores = await prisma.contractorPerformanceScore.findMany({
      where: {
        contractorId: project.contractorId,
        projectId,
      },
      orderBy: { evaluationMonth: 'desc' },
      select: {
        id: true,
        evaluationMonth: true,
        score: true,
        scheduleScore: true,
        qualityScore: true,
        safetyScore: true,
        patPassPct: true,
        reworkCount: true,
        timelineAdherencePct: true,
        completedTasksCount: true,
        delayedTasksCount: true,
        hseIncidentCount: true,
        autoCalculated: true,
        evaluatedAt: true,
      },
    });

    // Get PAT stats for this project
    const patStats = await prisma.pATSession.aggregate({
      where: { projectId, status: { in: ['COMPLETED', 'FAILED'] } },
      _avg: { passRate: true },
      _count: { id: true },
    });

    return NextResponse.json({
      contractor: project.contractor,
      kpiScores: scores,
      latestScore: scores[0] || null,
      patStats: {
        totalSessions: patStats._count.id,
        avgPassRate: patStats._avg.passRate ? Math.round(patStats._avg.passRate * 10) / 10 : 0,
      },
    });
  } catch (error) {
    console.error('Error fetching contractor KPI:', error);
    return NextResponse.json({ error: 'Failed to fetch KPI data' }, { status: 500 });
  }
}

// POST /api/projects/[id]/contractor-kpi - Calculate latest monthly KPI
export async function POST(request: Request, { params }: { params: Params }) {
  try {
    const { id: projectId } = await params;
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { month } = body; // "YYYY-MM" format

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { contractorId: true },
    });

    if (!project?.contractorId) {
      return NextResponse.json({ error: 'No contractor assigned to this project' }, { status: 404 });
    }

    const evaluationMonth = month || new Date().toISOString().substring(0, 7);
    const score = await ContractorKPIService.calculateMonthlyScore(
      project.contractorId,
      evaluationMonth,
      projectId
    );

    return NextResponse.json(
      { message: `KPI calculated for ${evaluationMonth}`, score },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to calculate KPI';
    console.error('KPI calculation error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}