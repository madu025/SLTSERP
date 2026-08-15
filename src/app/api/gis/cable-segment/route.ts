import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { GISRouteService } from '@/services/gis/GISRouteService';
import { safe } from '@/utils/safe-await.util';
export const dynamic = 'force-dynamic';
export const PATCH = apiHandler(async (req) => {
  const [jsonErr, body] = await safe<Record<string, unknown>>(req.json());
  if (jsonErr || !body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { segmentId, coordinates, length } = body as { segmentId: string; coordinates: [number, number][]; length?: number };
  if (!segmentId) {
    return NextResponse.json({ error: 'Segment ID is required' }, { status: 400 });
  }
  if (!coordinates || !Array.isArray(coordinates)) {
    return NextResponse.json({ error: 'Coordinates are required and must be an array of lon/lat points' }, { status: 400 });
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
  const [updateErr, updatedSegment] = await safe(GISRouteService.updateCableSegment(segmentId, coordinates, computedLength));
  if (updateErr || !updatedSegment) {
    console.error('Error updating cable segment:', updateErr);
    return NextResponse.json({ error: updateErr?.message || 'Failed to update segment' }, { status: 500 });
  }
  return NextResponse.json({
    message: 'Cable segment updated successfully',
    segment: updatedSegment
  });
}, { rawResponse: true });
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