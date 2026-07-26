import { NextRequest, NextResponse } from 'next/server';
import { GISRouteService } from '@/services/gis/GISRouteService';
import { ProjectSurveyService } from '@/services/project-survey.service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { segmentId } = body;

    if (!segmentId) {
      return NextResponse.json({ error: 'Segment ID is required' }, { status: 400 });
    }

    const { updatedSegment, projectId } = await GISRouteService.addSlackLoop(segmentId);

    // Trigger BOQ recalculation
    await ProjectSurveyService.completeSurveyAndGenerateBOQ(projectId, {});

    return NextResponse.json({
      success: true,
      segment: updatedSegment,
    });
  } catch (error: any) {
    console.error('[API-SLACK] Error adding slack loop:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update segment slack loops' },
      { status: 500 }
    );
  }
}
