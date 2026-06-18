import { NextResponse } from 'next/server';
import { MapApprovalService } from '@/services/map-approval.service';

type Params = Promise<{ id: string; pointId: string }>;

// PATCH /api/projects/[id]/survey/points/[pointId]
// action: "verify" | "approve" | "reject" | "flag"
export async function PATCH(request: Request, { params }: { params: Params }) {
  try {
    const { pointId } = await params;
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, reason } = body;

    let result;
    switch (action) {
      case 'verify':
        result = await MapApprovalService.verifyPoint({ pointId, userId });
        break;
      case 'approve':
        result = await MapApprovalService.approvePoint({ pointId, userId });
        break;
      case 'reject':
        result = await MapApprovalService.rejectPoint({ pointId, userId, reason });
        break;
      case 'flag':
        result = await MapApprovalService.flagPoint({ pointId, userId, reason });
        break;
      default:
        return NextResponse.json({ error: 'Invalid action. Use: verify, approve, reject, flag' }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update point';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
