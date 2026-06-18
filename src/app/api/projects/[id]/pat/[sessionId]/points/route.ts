import { NextResponse } from 'next/server';
import { PATService } from '@/services/pat.service';

type Params = Promise<{ id: string; sessionId: string }>;

// POST /api/projects/[id]/pat/[sessionId]/points - Add point result
export async function POST(request: Request, { params }: { params: Params }) {
  try {
    const { sessionId } = await params;
    const body = await request.json();

    const result = await PATService.recordPointResult(sessionId, body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to record PAT result';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/projects/[id]/pat/[sessionId]/points - Complete session
// action: "complete"
export async function PATCH(request: Request, { params }: { params: Params }) {
  try {
    const { sessionId } = await params;
    const body = await request.json();
    const { action, sltOfficers } = body;

    if (action === 'complete') {
      const result = await PATService.completeSession(sessionId, sltOfficers);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update PAT session';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
