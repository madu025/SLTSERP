import { NextResponse } from 'next/server';
import { GISRouteOptimizerService } from '@/services/gis-optimizer.service';
import { requireAuth } from '@/lib/server-utils';

type Params = Promise<{ id: string; routeId: string }>;

// GET /api/projects/[id]/gis/[routeId]/optimize - Detect overlaps & optimize survey path
export async function GET(request: Request, { params }: { params: Params }) {
    try {
        // Require auth
        await requireAuth();

        const { id: projectId, routeId } = await params;
        const { searchParams } = new URL(request.url);
        const tolerance = parseInt(searchParams.get('tolerance') || '10');

        const result = await GISRouteOptimizerService.optimizeRoute(projectId, routeId, tolerance);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error optimizing GIS route:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to optimize GIS route' },
            { status: 500 }
        );
    }
}
