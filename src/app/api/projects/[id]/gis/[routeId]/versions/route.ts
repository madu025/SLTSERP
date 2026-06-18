import { NextResponse } from 'next/server';
import { RouteVersionService } from '@/services/route-version.service';

type Params = Promise<{ id: string; routeId: string }>;

// GET /api/projects/[id]/gis/[routeId]/versions - Get version history
export async function GET(_request: Request, { params }: { params: Params }) {
  try {
    const { routeId, } = await params;
    const userId = _request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const history = await RouteVersionService.getVersionHistory(routeId);
    return NextResponse.json(history);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch version history';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/projects/[id]/gis/[routeId]/versions - Create new version or rollback
export async function POST(request: Request, { params }: { params: Params }) {
  try {
    const { id: projectId, routeId, } = await params;
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { action, versionType, changeRequestId, geojsonData } = body;

    // ── Action: NEW VERSION ──────────────────────────────────────
    if (action === 'new_version' || !action) {
      if (!versionType) {
        return NextResponse.json({ error: 'versionType is required (PLANNED, FIELD_CHANGE, AS_BUILT)' }, { status: 400 });
      }

      const result = await RouteVersionService.createNewVersion({
        projectId,
        routeId,
        versionType,
        changeRequestId,
        geojsonData,
      });

      return NextResponse.json({ message: `New version created: v${result.current.version}`, ...result }, { status: 201 });
    }

    // ── Action: ROLLBACK ─────────────────────────────────────────
    if (action === 'rollback') {
      const result = await RouteVersionService.rollback(routeId);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid action. Use: new_version, rollback' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Route versioning failed';
    console.error('Route versioning error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}