import { getAuthenticatedUserId } from '@/lib/request-context';
import { apiHandler } from '@/lib/api-handler';
import { SystemMonitoringService } from '@/services/admin/system-monitoring.service';

export const dynamic = 'force-dynamic';

// PATCH /api/admin/monitoring/errors/[id] - Mark an error as resolved
export const PATCH = apiHandler(async (req, params) => {
    const userId = getAuthenticatedUserId() || 'system-admin';
    const { id } = await params;

    return await SystemMonitoringService.markResolved(id, userId);
}, {
    audit: { action: 'MARK_ERROR_RESOLVED', entity: 'SystemErrorLog' }
});
