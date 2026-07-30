import { ROLE_GROUPS } from '@/config/roles';
export const dynamic = 'force-dynamic';

import { apiHandler } from '@/lib/api-handler';
import { AuditService } from '@/services/audit/audit.service';

export const GET = apiHandler(async () => {
    const logs = await AuditService.getRecentLogs(200);
    return logs;
}, {
    roles: ROLE_GROUPS.ADMINS
});
