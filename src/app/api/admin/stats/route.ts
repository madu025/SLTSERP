import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';
import { AdminSystemService } from '@/services/admin/system.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async () => {
    const stats = await AdminSystemService.getSystemStats();
    return Response.json(stats);
}, {
    roles: ROLE_GROUPS.ADMINS
});
