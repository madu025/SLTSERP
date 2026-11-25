import { apiHandler } from '@/lib/api-handler';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { AutomatedNoticesService } from '@/services/admin/automated-notices.service';

export const dynamic = 'force-dynamic';

// GET /api/admin/automated-notices/[audience]/people - the people an audience reaches right now
export const GET = apiHandler(async (req) => {
    const audience = new URL(req.url).pathname.split('/').slice(-2)[0] ?? '';
    return AutomatedNoticesService.people(audience);
}, { permissions: [RBAC_PERMISSIONS.ADMIN_RBAC] });
