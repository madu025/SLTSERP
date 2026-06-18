import { NextResponse } from 'next/server';
import { MapApprovalService } from '@/services/map-approval.service';

// GET /api/projects/[id]/survey/points
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params;
    const { searchParams } = new URL(request.url);
    const layerId = searchParams.get('layerId') ?? undefined;
    const status = searchParams.get('status') ?? undefined;
    const page = parseInt(searchParams.get('page') ?? '1');
    const limit = parseInt(searchParams.get('limit') ?? '50');

    const result = await MapApprovalService.getSurveyPoints(projectId, { layerId, status, page, limit });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching survey points:', error);
    return NextResponse.json({ error: 'Failed to fetch survey points' }, { status: 500 });
  }
}

// POST /api/projects/[id]/survey/points - Create new survey point
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params;
    const body = await request.json();
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId, layerId, layerName, latitude, longitude, attributes, photoUrls } = body;
    if (!sessionId || !layerId || !latitude || !longitude) {
      return NextResponse.json({ error: 'Missing required fields: sessionId, layerId, latitude, longitude' }, { status: 400 });
    }

    const { prisma } = await import('@/lib/prisma');
    const point = await prisma.surveyPoint.create({
      data: {
        sessionId,
        projectId,
        layerId,
        layerName: layerName || layerId,
        latitude,
        longitude,
        attributes: attributes || {},
        photoUrls: photoUrls || [],
        supervisorId: userId,
      },
    });

    return NextResponse.json(point, { status: 201 });
  } catch (error) {
    console.error('Error creating survey point:', error);
    return NextResponse.json({ error: 'Failed to create survey point' }, { status: 500 });
  }
}
