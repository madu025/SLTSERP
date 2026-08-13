import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';
import { SystemMonitoringService } from '@/services/admin/system-monitoring.service';

export const dynamic = 'force-dynamic';

// PATCH /api/admin/monitoring/errors/[id] - Mark an error as resolved
export const PATCH = apiHandler(async (req, params) => {
    const userId = req.headers.get('x-user-id') || 'system-admin';
    const { id } = await params;

    return await SystemMonitoringService.markResolved(id, userId);
}, {
    roles: ROLE_GROUPS.ADMINS,
    audit: { action: 'MARK_ERROR_RESOLVED', entity: 'SystemErrorLog' }
});
