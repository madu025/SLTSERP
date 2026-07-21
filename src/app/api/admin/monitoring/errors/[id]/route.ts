import { apiHandler } from '@/lib/api-handler';
import { SystemMonitoringService } from '@/services/admin/system-monitoring.service';
import { requireAuth } from '@/lib/server-utils';

// PATCH /api/admin/monitoring/errors/[id] - Mark an error as resolved
export const PATCH = apiHandler(async (_req, params) => {
    const user = await requireAuth(['SUPER_ADMIN', 'ADMIN']);
    const { id } = await params;

    return await SystemMonitoringService.markResolved(id, user.id);
}, {
    roles: ['SUPER_ADMIN', 'ADMIN'],
    audit: { action: 'MARK_ERROR_RESOLVED', entity: 'SystemErrorLog' }
});
