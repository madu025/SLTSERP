import { NextResponse } from 'next/server';
import { PATService } from '@/services/pat.service';
import { prisma } from '@/lib/prisma';

type Params = Promise<{ id: string }>;

// GET /api/projects/[id]/pat - All PAT sessions
export async function GET(_request: Request, { params }: { params: Params }) {
  try {
    const { id: projectId } = await params;
    const sessions = await PATService.getProjectSessions(projectId);
    return NextResponse.json(sessions);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch PAT sessions' }, { status: 500 });
  }
}

// POST /api/projects/[id]/pat - Start a new PAT session
export async function POST(request: Request, { params }: { params: Params }) {
  try {
    const { id: projectId } = await params;
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { patType } = body;

    if (!patType || !['PRE_PAT', 'SLT_PAT'].includes(patType)) {
      return NextResponse.json({ error: 'Invalid patType. Must be PRE_PAT or SLT_PAT' }, { status: 400 });
    }

    const session = await PATService.startSession(projectId, patType, userId);
    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start PAT session';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
