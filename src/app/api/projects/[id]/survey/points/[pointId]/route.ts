import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MapApprovalService } from '@/services/map-approval.service';

type Params = Promise<{ id: string; pointId: string }>;

// PATCH /api/projects/[id]/survey/points/[pointId]
// action: "verify" | "approve" | "reject" | "flag" | "update_coordinates"
// When action="update_coordinates", body must include { latitude: number, longitude: number }
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

        // Fetch existing point to merge attributes
        const existing = await prisma.surveyPoint.findUnique({
          where: { id: pointId },
        });

        if (!existing) {
          return NextResponse.json({ error: 'Survey point not found' }, { status: 404 });
        }

        const existingAttrs = (existing.attributes as Record<string, unknown>) || {};

        // Update the point with new coordinates and merge geometry into attributes
        const updated = await prisma.surveyPoint.update({
          where: { id: pointId },
          data: {
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            attributes: {
              ...existingAttrs,
              geometry: {
                type: 'Point',
                coordinates: [parseFloat(longitude), parseFloat(latitude)],
              },
              _lastCoordinateEditBy: userId,
              _lastCoordinateEditAt: new Date().toISOString(),
            },
            verificationStatus: existing.verificationStatus, // preserve status
          },
        });

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
              'Invalid action. Use: verify, approve, reject, flag, update_coordinates',
          },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update point';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}