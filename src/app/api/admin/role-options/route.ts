export const dynamic = 'force-dynamic';

import { apiHandler } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';
import { ROLE_CATEGORIES } from '@/config/roles';

/**
 * Dynamic role options for the Administration UI (user create/edit, global roles).
 * Reads the live Postgres "Role" enum — adding a new enum value in the schema
 * automatically makes it selectable in the UI without frontend code changes.
 * Category grouping comes from the single shared ROLE_CATEGORIES map;
 * unmapped roles fall into "Other" on the client.
 */
export const GET = apiHandler(async () => {
    const rows = await prisma.$queryRawUnsafe<Array<{ role: string }>>(
        'SELECT unnest(enum_range(NULL::"Role")) AS role'
    );

    return {
        roles: rows.map((r) => r.role),
        categories: ROLE_CATEGORIES
    };
}, { rawResponse: true, roles: ['SUPER_ADMIN', 'ADMIN', 'HEAD_OF_SECTION', 'OSP_MANAGER'] });
