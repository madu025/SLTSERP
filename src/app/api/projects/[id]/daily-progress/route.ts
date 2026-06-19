import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Params = Promise<{ id: string }>;

// GET /api/projects/[id]/daily-progress
export async function GET(_request: Request, { params }: { params: Params }) {
  try {
    const { id: projectId } = await params;
    const records = await prisma.dailyProgress.findMany({
      where: { projectId },
      orderBy: { reportDate: 'desc' },
    });
    return NextResponse.json(records);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch daily progress' }, { status: 500 });
  }
}

// POST /api/projects/[id]/daily-progress
export async function POST(request: Request, { params }: { params: Params }) {
  try {
    const { id: projectId } = await params;
    const userId = request.headers.get('x-user-id') ?? undefined;
    const body = await request.json();

    const record = await prisma.dailyProgress.create({
      data: {
        projectId,
        reportDate: body.reportDate ? new Date(body.reportDate) : new Date(),
        polesErected: body.polesErected ?? 0,
        cablePulled: body.cablePulled ?? 0,
        chambersInstalled: body.chambersInstalled ?? 0,
        closuresInstalled: body.closuresInstalled ?? 0,
        jointsCompleted: body.jointsCompleted ?? 0,
        fdpsInstalled: body.fdpsInstalled ?? 0,
        teamSize: body.teamSize,
        hoursWorked: body.hoursWorked,
        laborCost: body.laborCost ?? 0,
        progressPct: body.progressPct ?? 0,
        notes: body.notes,
        reportedById: userId,
        photoUrls: body.photoUrls ?? [],
      },
    });

    // If progressPct is provided, update the project's overall progress
    if (body.progressPct != null) {
      await prisma.project.update({
        where: { id: projectId },
        data: { progress: body.progressPct },
      });
    }

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create record';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
