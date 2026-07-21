import { apiHandler } from '@/lib/api-handler';
import { GISAuditService } from '@/services/gis-audit.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request, params) => {
    const { id: projectId } = params;
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
        throw AppError.unauthorized('Unauthorized');
    }

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
        return await GISAuditService.getAuditTrail(entityType, entityId, { page, limit });
    }

    // Project-level filtered queries
    return await GISAuditService.getProjectLogs(projectId, {
        entityType,
        action,
        source,
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
        page,
        limit,
    });
}, { rawResponse: true });