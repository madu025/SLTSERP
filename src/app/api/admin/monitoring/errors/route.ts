import { apiHandler } from '@/lib/api-handler';
import { SystemMonitoringService } from '@/services/admin/system-monitoring.service';

export const dynamic = 'force-dynamic';

// GET /api/admin/monitoring/errors - Paginated error log list for Super Admin
export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);

    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '25', 10);
    const statusCode = searchParams.get('statusCode') ? parseInt(searchParams.get('statusCode')!, 10) : undefined;
    const path = searchParams.get('path') || undefined;
    const resolvedStr = searchParams.get('resolved');
    const resolved = resolvedStr === 'true' ? true : resolvedStr === 'false' ? false : undefined;
    const search = searchParams.get('search') || undefined;

    return await SystemMonitoringService.getErrorLogs({
        page,
        limit,
        statusCode,
        path,
        resolved,
        search
    });
}, {
    roles: ['SUPER_ADMIN', 'ADMIN']
});

// DELETE /api/admin/monitoring/errors - Bulk clear error logs
export const DELETE = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const daysToKeep = parseInt(searchParams.get('daysToKeep') || '14', 10);

    return await SystemMonitoringService.clearLogs(daysToKeep);
}, {
    roles: ['SUPER_ADMIN'],
    audit: { action: 'CLEAR_SYSTEM_ERROR_LOGS', entity: 'SystemErrorLog' }
});
