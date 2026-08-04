import { ROLE_GROUPS } from '@/config/roles';
export const dynamic = 'force-dynamic';

import { apiHandler } from '@/lib/api-handler';
import { RoleService } from '@/services/admin/role.service';
import { z } from 'zod';

const createRoleSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    code: z.string().min(1, 'Code is required'),
    description: z.string().optional(),
    level: z.number().optional(),
    permissions: z.string().optional()
});

export const GET = apiHandler(async (_req, params) => {
    const { id } = await params;
    const roles = await RoleService.getRolesBySection(id);
    return roles;
}, {
    roles: ROLE_GROUPS.ADMINS,
    rawResponse: true
});

export const POST = apiHandler(async (_req, params, body) => {
    const { id } = await params;
    const data = createRoleSchema.parse(body);

    const role = await RoleService.createRole({
        ...data,
        sectionId: id
    });

    return role;
}, {
    roles: ROLE_GROUPS.SUPER_ADMINS,
    rawResponse: true,
    audit: { action: 'CREATE_ROLE', entity: 'Admin' }
});
