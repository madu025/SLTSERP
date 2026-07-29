import { ROLE_GROUPS } from '@/config/roles';
export const dynamic = 'force-dynamic';

import { apiHandler } from '@/lib/api-handler';
import { AiAuditService } from '@/services/inventory/ai-audit.service';

export const GET = apiHandler(async () => {
    const auditReport = await AiAuditService.runSystemAudit();
    return Response.json({ success: true, data: auditReport });
}, {
    roles: ROLE_GROUPS.PROJECT_MANAGERS
});
