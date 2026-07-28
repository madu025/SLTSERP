import { ROLE_GROUPS } from '@/config/roles';
export const dynamic = 'force-dynamic';

import { apiHandler } from '@/lib/api-handler';
import { UserService } from '@/services/user.service';
import { z } from 'zod';

const updatePermissionsSchema = z.object({
    permissions: z.array(z.string()).min(1, 'Permissions must be a non-empty array')
});

// GET - Fetch user's permissions
export const GET = apiHandler(async (_req, params) => {
    const permissions = await UserService.getUserPermissions(params.userId);
    return Response.json(permissions);
}, {
    roles: ROLE_GROUPS.ADMINS
});

// PATCH - Update user's permissions
export const PATCH = apiHandler(async (_req, params, body) => {
    const { permissions } = body;
    await UserService.updateUserPermissions(params.userId, permissions);
    return Response.json({ message: 'Permissions updated successfully' });
}, {
    schema: updatePermissionsSchema,
    roles: ROLE_GROUPS.ADMINS,
    audit: { action: 'UPDATE_USER_PERMISSIONS', entity: 'User' }
});
