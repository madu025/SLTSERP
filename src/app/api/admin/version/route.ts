import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';
import { getWebVersion } from '@/lib/app-version';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async () => {
    return Response.json({ success: true, ...getWebVersion() });
}, {
    roles: ROLE_GROUPS.ADMINS,
});
