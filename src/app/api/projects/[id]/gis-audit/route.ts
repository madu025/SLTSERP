import { NextResponse } from 'next/server';
import { GISAuditService } from '@/services/gis-audit.service';

type Params = Promise<{ id: string }>;

// GET /api/projects/[id]/gis-audit - Get audit trail for project or specific entity
export async function GET(request: Request, { params }: { params: Params }) {
  try {
    const { id: projectId } = await params;
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType') ?? undefined;
    const entityId = searchParams.get('entityId') ?? undefined;
    const action = searchParams.get('action') ?? undefined;
    const source = searchParams.get('source') ?? undefined;
    const from = searchParams.get('from') ?? undefined;
    const to = searchParams.get('to') ?? undefined;
    const page = parseInt(searchParams.get('page') ?? '1');
    const limit = parseInt(searchParams.get('limit') ?? '50');

    // If querying a specific entity
    if (entityType && entityId) {
      const result = await GISAuditService.getAuditTrail(entityType, entityId, { page, limit });
      return NextResponse.json(result);
    }

    // Project-level filtered queries
    const result = await GISAuditService.getProjectLogs(projectId, {
      entityType,
      action,
      source,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching GIS audit:', error);
    return NextResponse.json({ error: 'Failed to fetch audit data' }, { status: 500 });
  }
}