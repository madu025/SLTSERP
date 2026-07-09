import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { segmentId, coordinates, length } = body;

    if (!segmentId) {
      return NextResponse.json({ error: 'Segment ID is required' }, { status: 400 });
    }
    if (!coordinates || !Array.isArray(coordinates)) {
      return NextResponse.json({ error: 'Coordinates are required and must be an array of lon/lat points' }, { status: 400 });
    }

    // 1. Fetch the cable segment
    const segment = await prisma.gISCableSegment.findUnique({
      where: { id: segmentId },
      include: { route: true }
    });

    if (!segment) {
      return NextResponse.json({ error: 'Cable segment not found' }, { status: 404 });
    }

    // Calculate length in meters if not provided using haversine distance
    let computedLength = length;
    if (computedLength === undefined) {
      let dist = 0;
      for (let i = 0; i < coordinates.length - 1; i++) {
        const [lon1, lat1] = coordinates[i];
        const [lon2, lat2] = coordinates[i + 1];
        dist += haversineDistance(lat1, lon1, lat2, lon2);
      }
      computedLength = dist;
    }

    const currentProperties = (segment.properties as Record<string, any>) || {};
    const updatedProperties = {
      ...currentProperties,
      coordinates
    };

    // Update coordinates in the properties JSON object and update length
    const updatedSegment = await prisma.gISCableSegment.update({
      where: { id: segmentId },
      data: {
        properties: updatedProperties,
        length: computedLength
      }
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

    return NextResponse.json({
      message: 'Cable segment updated successfully',
      segment: updatedSegment
    });
  } catch (error: any) {
    console.error('Error updating cable segment:', error);
    return NextResponse.json({ error: error.message || 'Failed to update segment' }, { status: 500 });
  }
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in metres
}
