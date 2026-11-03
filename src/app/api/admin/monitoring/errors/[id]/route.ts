import { apiHandler } from '@/lib/api-handler';
import { SystemMonitoringService } from '@/services/admin/system-monitoring.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

// PATCH /api/admin/monitoring/errors/[id] - Mark an error as resolved
export const PATCH = apiHandler(async (req, params) => {
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');
    const { id } = await params;

    return await SystemMonitoringService.markResolved(id, userId);
}, {
    audit: { action: 'MARK_ERROR_RESOLVED', entity: 'SystemErrorLog' }
});
