import { apiHandler } from '@/lib/api-handler';
import { AuditService } from '@/services/audit.service';

export const GET = apiHandler(async () => {
    const logs = await AuditService.getRecentLogs(200);
    return Response.json(logs);
}, {
    roles: ['ADMIN', 'SUPER_ADMIN']
});
