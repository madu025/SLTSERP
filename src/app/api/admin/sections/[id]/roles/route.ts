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
    return Response.json(roles);
}, {
    roles: ['SUPER_ADMIN', 'ADMIN']
});

export const POST = apiHandler(async (_req, params, body) => {
    const { id } = await params;
    const data = createRoleSchema.parse(body);

    const role = await RoleService.createRole({
        ...data,
        sectionId: id
    });

    return Response.json(role, { status: 201 });
}, {
    roles: ['SUPER_ADMIN', 'ADMIN'],
    audit: { action: 'CREATE_ROLE', entity: 'Admin' }
});
