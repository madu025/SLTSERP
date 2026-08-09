export const dynamic = 'force-dynamic';

import { apiHandler } from '@/lib/api-handler';
import { AdminSystemService } from '@/services/admin/system.service';
import { ROLE_GROUPS } from '@/config/roles';

export const GET = apiHandler(async () => {
    const status = await AdminSystemService.getSyncStats();
    return Response.json(status);
}, {
    roles: ROLE_GROUPS.CORE_ADMINS
});
