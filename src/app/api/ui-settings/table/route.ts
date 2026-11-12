export const dynamic = 'force-dynamic';

import { apiHandler } from '@/lib/api-handler';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { AdminSystemService } from '@/services/admin/system.service';
import { TABLE_COLUMNS } from '@/config/table-columns';

/**
 * GET: visible-column settings for a table. Read-only and display-only, so any signed-in user may read it.
 * (The admin route stays the only way to change it; reading it through /api/admin returned 403 for staff.)
 */
export const GET = apiHandler(async (req) => {
    const tableName = new URL(req.url).searchParams.get('tableName');
    return AdminSystemService.getTableSettings(tableName, TABLE_COLUMNS);
}, {
    // Display-only column settings, read by every table screen for any signed-in user
    permissions: [RBAC_PERMISSIONS.DASHBOARD_READ],
    rawResponse: true
});
