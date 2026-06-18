import { NextResponse } from 'next/server';
import { ChangeRequestService } from '@/services/change-request.service';

type Params = Promise<{ id: string }>;

// GET /api/projects/[id]/change-requests
export async function GET(_request: Request, { params }: { params: Params }) {
  try {
    const { id: projectId } = await params;
    const userId = _request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const requests = await ChangeRequestService.getForProject(projectId);
    return NextResponse.json(requests);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch change requests' }, { status: 500 });
  }
}

// POST /api/projects/[id]/change-requests
export async function POST(request: Request, { params }: { params: Params }) {
  try {
    const { id: projectId } = await params;
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { changeType, title, description, costImpact, timeImpact, routeChangeData } = body;

    if (!changeType || !title) {
      return NextResponse.json({ error: 'changeType and title are required' }, { status: 400 });
    }

    const result = await ChangeRequestService.create({
      projectId,
      changeType,
      title,
      description,
      costImpact,
      timeImpact,
      routeChangeData,
      requestedById: userId,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create change request';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}