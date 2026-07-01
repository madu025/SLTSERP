import { NextResponse } from 'next/server';
import { ProjectSurveyService } from '@/services/project-survey.service';

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

    const sessions = await ProjectSurveyService.getSessions(projectId, { status, supervisorId });
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

    if (action !== 'start' && action !== 'continue') {
      return NextResponse.json({ error: 'Invalid action. Use "start" or "continue"' }, { status: 400 });
    }

    const result = await ProjectSurveyService.startOrContinueSession(projectId, userId, action, sessionId, notes);
    const status = result.action === 'started' ? 201 : 200;
    return NextResponse.json(result, { status });
  } catch (error: any) {
    console.error('Session error:', error);
    const message = error.message;
    if (message === 'SUPERVISOR_NOT_ASSIGNED') {
      return NextResponse.json({ error: 'You are not assigned as supervisor for this project' }, { status: 403 });
    }
    if (message === 'SESSION_ID_REQUIRED') {
      return NextResponse.json({ error: 'sessionId required for continue action' }, { status: 400 });
    }
    if (message === 'SESSION_NOT_FOUND_OR_UNAUTHORIZED') {
      return NextResponse.json({ error: 'Session not found or unauthorized' }, { status: 404 });
    }
    if (message === 'SESSION_ALREADY_COMPLETED') {
      return NextResponse.json({ error: 'Session is already completed' }, { status: 400 });
    }
    if (message === 'SESSION_ABANDONED') {
      return NextResponse.json({ error: 'Session was abandoned. Start a new session instead.' }, { status: 400 });
    }
    return NextResponse.json({ error: message || 'Failed to manage survey session' }, { status: 500 });
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

    if (action !== 'complete' && action !== 'abandon') {
      return NextResponse.json({ error: 'Invalid action. Use "complete" or "abandon"' }, { status: 400 });
    }

    const result = await ProjectSurveyService.updateSessionStatus(projectId, userId, sessionId, action, notes);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Session update error:', error);
    const message = error.message;
    if (message === 'SESSION_NOT_FOUND_OR_UNAUTHORIZED') {
      return NextResponse.json({ error: 'Session not found or unauthorized' }, { status: 404 });
    }
    return NextResponse.json({ error: message || 'Failed to update session' }, { status: 500 });
  }
}