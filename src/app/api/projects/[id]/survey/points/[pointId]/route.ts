import { NextResponse } from 'next/server';
import { MapApprovalService } from '@/services/map-approval.service';

type Params = Promise<{ id: string; pointId: string }>;

// PATCH /api/projects/[id]/survey/points/[pointId]
// action: "verify" | "confirm" | "approve" | "reject" | "flag" | "update_coordinates"
// Workflow: PENDING_VERIFICATION → verify → VERIFIED → confirm → PENDING_APPROVAL → approve → APPROVED
export async function PATCH(request: Request, { params }: { params: Params }) {
  try {
    const { id: projectId, pointId } = await params;
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, reason } = body;

    // ─── Approval workflow actions ────────────────────────────────────
    let result;
    switch (action) {
      case 'verify':
        result = await MapApprovalService.verifyPoint({ pointId, userId });
        break;
      case 'confirm':
        result = await MapApprovalService.confirmPoint({ pointId, userId });
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
      case 'update_coordinates': {
        const { latitude, longitude } = body;
        if (latitude == null || longitude == null) {
          return NextResponse.json(
            { error: 'latitude and longitude are required for update_coordinates' },
            { status: 400 }
          );
        }

        const updated = await MapApprovalService.updatePointCoordinates(
          pointId,
          parseFloat(latitude),
          parseFloat(longitude),
          userId
        );

        return NextResponse.json({
          success: true,
          message: 'Coordinates updated successfully',
          point: updated,
        });
      }
      default:
        return NextResponse.json(
          {
            error:
              'Invalid action. Use: verify, confirm, approve, reject, flag, update_coordinates',
          },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (error: any) {
    const message = error.message;
    if (message === 'SURVEY_POINT_NOT_FOUND') {
      return NextResponse.json({ error: 'Survey point not found' }, { status: 404 });
    }
    return NextResponse.json({ error: message || 'Failed to update point' }, { status: 500 });
  }
}