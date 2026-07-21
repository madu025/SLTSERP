import { apiHandler } from '@/lib/api-handler';
import { RoleService } from '@/services/admin/role.service';
import { z } from 'zod';

const updateRoleSchema = z.object({
    name: z.string().optional(),
    code: z.string().optional(),
    description: z.string().optional(),
    level: z.number().optional(),
    permissions: z.string().optional(),
    isActive: z.boolean().optional()
});

// PATCH - Update role
export const PATCH = apiHandler(async (_req, params, body) => {
    const { roleId } = await params;
    const data = updateRoleSchema.parse(body);

    const role = await RoleService.updateRole(roleId, data);
    return Response.json(role);
}, {
    roles: ['SUPER_ADMIN', 'ADMIN'],
    audit: { action: 'UPDATE_ROLE', entity: 'Admin' }
});

// DELETE - Delete role
export const DELETE = apiHandler(async (_req, params) => {
    const { roleId } = await params;
    
    await RoleService.deleteRole(roleId);
    return Response.json({ message: 'Role deleted successfully' });
}, {
    roles: ['SUPER_ADMIN', 'ADMIN'],
    audit: { action: 'DELETE_ROLE', entity: 'Admin' }
});
