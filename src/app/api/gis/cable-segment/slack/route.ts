import { NextRequest, NextResponse } from 'next/server';
import { GISRouteService } from '@/services/gis/GISRouteService';
import { ProjectSurveyService } from '@/services/project-survey.service';

import { safe } from '@/utils/safe-await.util';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const [jsonErr, body] = await safe<Record<string, unknown>>(req.json());
  
  if (jsonErr || !body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { segmentId } = body as { segmentId: string };

    if (!segmentId) {
      return NextResponse.json({ error: 'Segment ID is required' }, { status: 400 });
    }

    const [routeErr, result] = await safe(GISRouteService.addSlackLoop(segmentId));
    
    if (routeErr || !result) {
      console.error('[API-SLACK] Error adding slack loop:', routeErr);
      return NextResponse.json(
        { error: routeErr?.message || 'Failed to update segment slack loops' },
        { status: 500 }
      );
    }

    const { updatedSegment, projectId } = result;

    // Trigger BOQ recalculation
    const [boqErr] = await safe(ProjectSurveyService.completeSurveyAndGenerateBOQ(projectId, {}));
    if (boqErr) {
      console.error('[API-SLACK] Error generating BOQ:', boqErr.message);
    }

    return NextResponse.json({
      success: true,
      segment: updatedSegment,
    });
}
