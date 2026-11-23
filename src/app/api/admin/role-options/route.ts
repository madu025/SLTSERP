export const dynamic = 'force-dynamic';

import { apiHandler } from '@/lib/api-handler';
import { UserAdminService } from '@/services/hr/user-admin.service';
import { ROLE_CATEGORIES } from '@/config/roles';
import { OPMC_REQUIRED_ROLES } from '@/config/user-admin';

/**
 * Options for the Administration user form. Reads the live Postgres "Role" enum, so a new enum value is selectable without
 * frontend code changes, and tells the form which roles really have a SystemRole (a user without one would have no permissions),
 * which module designations exist per section, and which roles need an OPMC / RTOM.
 * Category grouping comes from the shared ROLE_CATEGORIES map; unmapped roles fall into "Other" on the client.
 */
export const GET = apiHandler(async () => {
    const o = await UserAdminService.formOptions();
    return {
        roles: o.roles,
        baseAvailable: o.baseAvailable,
        designations: o.designations,
        scopeAll: o.scopeAll,
        opmcRequiredRoles: OPMC_REQUIRED_ROLES,
        categories: ROLE_CATEGORIES,
    };
}, { rawResponse: true });
