import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SURVEY_LAYERS } from '@/config/survey-layers';

type Params = Promise<{ id: string }>;

// GET /api/projects/[id]/survey/sessions - Get all sessions for a project
export async function GET(request: Request, { params }: { params: Params }) {
  try {
    const { id: projectId } = await params;
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const supervisorId = searchParams.get('supervisorId');

    const where: Record<string, unknown> = { projectId };
    if (status) where.status = status;
    if (supervisorId) where.supervisorId = supervisorId;

    const sessions = await prisma.mobileSurveySession.findMany({
      where,
      include: {
        _count: { select: { surveyPoints: true } },
      },
      orderBy: { startedAt: 'desc' },
    });

    return NextResponse.json(sessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}

// POST /api/projects/[id]/survey/sessions - Start new or continue existing session
export async function POST(request: Request, { params }: { params: Params }) {
  try {
    const { id: projectId } = await params;
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { action, sessionId, notes } = body;

    // ── Action: START new session ──────────────────────────────────────
    if (action === 'start') {
      // Check supervisor is assigned to this project
      const assignment = await prisma.projectSupervisorAssignment.findFirst({
        where: { projectId, supervisorId: userId, status: 'ASSIGNED' },
      });
      if (!assignment) {
        return NextResponse.json({ error: 'You are not assigned as supervisor for this project' }, { status: 403 });
      }

      // Check for existing in-progress session
      const existingSession = await prisma.mobileSurveySession.findFirst({
        where: { projectId, supervisorId: userId, status: 'IN_PROGRESS' },
      });

      if (existingSession) {
        return NextResponse.json(
          {
            message: 'Active session found. Use action=continue to resume.',
            session: existingSession,
            action: 'continue_existing',
          },
          { status: 200 }
        );
      }

      const session = await prisma.mobileSurveySession.create({
        data: {
          projectId,
          supervisorId: userId,
          status: 'IN_PROGRESS',
          notes,
        },
      });

      // Update project status to SURVEY_IN_PROGRESS if needed
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { status: true },
      });

      if (project?.status === 'PLANNING' || project?.status === 'SURVEY_IN_PROGRESS') {
        await prisma.project.update({
          where: { id: projectId },
          data: { status: 'SURVEY_IN_PROGRESS' },
        });
      }

      return NextResponse.json(
        { session, surveyLayers: SURVEY_LAYERS, action: 'started' },
        { status: 201 }
      );
    }

    // ── Action: CONTINUE existing session ──────────────────────────────
    if (action === 'continue') {
      if (!sessionId) {
        return NextResponse.json({ error: 'sessionId required for continue action' }, { status: 400 });
      }

      const session = await prisma.mobileSurveySession.findFirst({
        where: { id: sessionId, projectId, supervisorId: userId },
        include: { _count: { select: { surveyPoints: true } } },
      });

      if (!session) {
        return NextResponse.json({ error: 'Session not found or unauthorized' }, { status: 404 });
      }

      if (session.status === 'COMPLETED') {
        return NextResponse.json({ error: 'Session is already completed' }, { status: 400 });
      }

      if (session.status === 'ABANDONED') {
        return NextResponse.json({ error: 'Session was abandoned. Start a new session instead.' }, { status: 400 });
      }

      // Re-activate if paused
      await prisma.mobileSurveySession.update({
        where: { id: sessionId },
        data: {
          status: 'IN_PROGRESS',
          updatedAt: new Date(),
        },
      });

      // Get previously marked points for reference
      const previousPoints = await prisma.surveyPoint.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          layerId: true,
          latitude: true,
          longitude: true,
          attributes: true,
          createdAt: true,
        },
      });

      return NextResponse.json({
        session: { ...session, status: 'IN_PROGRESS' },
        previousPoints,
        surveyLayers: SURVEY_LAYERS,
        action: 'continued',
      });
    }

    return NextResponse.json({ error: 'Invalid action. Use "start" or "continue"' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to manage survey session';
    console.error('Session error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/projects/[id]/survey/sessions - Complete or abandon session
export async function PATCH(request: Request, { params }: { params: Params }) {
  try {
    const { id: projectId } = await params;
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { sessionId, action, notes } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const session = await prisma.mobileSurveySession.findFirst({
      where: { id: sessionId, projectId, supervisorId: userId },
      include: { _count: { select: { surveyPoints: true } } },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found or unauthorized' }, { status: 404 });
    }

    if (action === 'complete') {
      const updated = await prisma.mobileSurveySession.update({
        where: { id: sessionId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          pointsCount: session._count.surveyPoints,
          notes: notes || session.notes,
        },
      });

      // Check if all assigned sessions are complete
      const incompleteSessions = await prisma.mobileSurveySession.count({
        where: { projectId, status: 'IN_PROGRESS' },
      });

      if (incompleteSessions === 0) {
        await prisma.project.update({
          where: { id: projectId },
          data: { status: 'SURVEY_COMPLETE' },
        });
      }

      return NextResponse.json({ session: updated, action: 'completed' });
    }

    if (action === 'abandon') {
      const updated = await prisma.mobileSurveySession.update({
        where: { id: sessionId },
        data: {
          status: 'ABANDONED',
          notes: notes || 'Abandoned by supervisor',
          updatedAt: new Date(),
        },
      });

      return NextResponse.json({ session: updated, action: 'abandoned' });
    }

    return NextResponse.json({ error: 'Invalid action. Use "complete" or "abandon"' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update session';
    console.error('Session update error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}