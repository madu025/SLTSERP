import { NextResponse } from 'next/server';
import { MapApprovalService } from '@/services/map-approval.service';

type Params = Promise<{ id: string }>;

// POST /api/projects/[id]/survey/batch-approve - Batch verify or approve survey points
export async function POST(request: Request, { params }: { params: Params }) {
  try {
    const { id: projectId } = await params;
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { pointIds, action } = body;

    if (!pointIds || !Array.isArray(pointIds) || pointIds.length === 0) {
      return NextResponse.json({ error: 'pointIds array is required' }, { status: 400 });
    }

    if (!action || !['verify', 'approve'].includes(action)) {
      return NextResponse.json({ error: 'action must be "verify" or "approve"' }, { status: 400 });
    }

    let result: { succeeded: number; failed: number; total: number };

    if (action === 'verify') {
      result = await MapApprovalService.batchVerify(pointIds, userId);
    } else {
      result = await MapApprovalService.batchApprove(pointIds, userId);
    }

    return NextResponse.json({
      message: `Batch ${action} completed: ${result.succeeded}/${result.total} succeeded`,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Batch operation failed';
    console.error('Batch approve error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}