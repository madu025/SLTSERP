import { NextResponse } from 'next/server';
import { GISRouteService } from '@/services/gis/GISRouteService';
import { requireAuth } from '@/lib/server-utils';
import { handleApiError } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Secure endpoint
    await requireAuth();

    // Fetch active GIS routes and global stats
    const data = await GISRouteService.getActiveRoutesAndStats();

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}
