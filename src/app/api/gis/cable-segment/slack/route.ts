import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { GISRouteService } from '@/services/gis/GISRouteService';
import { ProjectSurveyService } from '@/services/project/project-survey.service';
import { AppError } from '@/lib/error';
import { safe } from '@/utils/safe-await.util';
export const dynamic = 'force-dynamic';
export const POST = apiHandler(async (req, params) => {
  const [jsonErr, body] = await safe<Record<string, unknown>>(req.json());
  if (jsonErr || !body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { segmentId } = body as { segmentId: string };
    if (!segmentId) {
      return NextResponse.json({ error: 'Segment ID is required' }, { status: 400 });
    }
    const [routeErr, result] = await safe(GISRouteService.addSlackLoop(segmentId, params._userId));
    if (routeErr || !result) {
      console.error('[API-SLACK] Error adding slack loop:', routeErr);
      return NextResponse.json(
        { error: routeErr?.message || 'Failed to update segment slack loops' },
        { status: routeErr instanceof AppError ? routeErr.statusCode : 500 }
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
}, { rawResponse: true });