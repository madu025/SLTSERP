import { apiHandler } from '@/lib/api-handler';
import { SystemMonitoringService } from '@/services/admin/system-monitoring.service';

export const dynamic = 'force-dynamic';

// GET /api/admin/monitoring/health - Fetch real-time system health metrics
export const GET = apiHandler(async () => {
    return await SystemMonitoringService.getHealthStats();
}, {
    roles: ['SUPER_ADMIN', 'ADMIN']
});
