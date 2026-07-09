import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ProjectSurveyService } from '@/services/project-survey.service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { segmentId } = body;

    if (!segmentId) {
      return NextResponse.json({ error: 'Segment ID is required' }, { status: 400 });
    }

    // 1. Fetch the cable segment and its route
    const segment = await prisma.gISCableSegment.findUnique({
      where: { id: segmentId },
      include: {
        route: true,
      },
    });

    if (!segment) {
      return NextResponse.json({ error: 'Cable segment not found' }, { status: 404 });
    }

    const currentProperties = (segment.properties as Record<string, any>) || {};
    const slackLoops = (currentProperties.slackLoops || 0) + 1;
    const newProperties = {
      ...currentProperties,
      slackLoops,
    };

    // Increment length by 20m
    const newLength = segment.length + 20.0;

    // Update the segment length and properties
    const updatedSegment = await prisma.gISCableSegment.update({
      where: { id: segmentId },
      data: {
        length: newLength,
        properties: newProperties,
      },
    });

    // Reset parent route status to DRAFT to allow BOQ regeneration
    if (segment.route.status === 'BOQ_GENERATED') {
      await prisma.gISRoute.update({
        where: { id: segment.routeId },
        data: { status: 'DRAFT' },
      });
    }

    // Clear old BOQs for this route to prevent duplicates
    await prisma.gISGeneratedBOQ.deleteMany({
      where: { routeId: segment.routeId },
    });

    // Trigger BOQ recalculation
    await ProjectSurveyService.completeSurveyAndGenerateBOQ(segment.route.projectId, {});

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
