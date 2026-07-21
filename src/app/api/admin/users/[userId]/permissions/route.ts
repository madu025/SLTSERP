import { apiHandler } from '@/lib/api-handler';
import { UserService } from '@/services/user.service';
import { z } from 'zod';

const updatePermissionsSchema = z.object({
    permissions: z.array(z.string()).min(1, 'Permissions must be a non-empty array')
});

// GET - Fetch user's permissions
export const GET = apiHandler(async (_req, params) => {
    const { userId } = await params;
    const permissions = await UserService.getUserPermissions(userId);
    
    return Response.json(permissions);
}, {
    roles: ['SUPER_ADMIN', 'ADMIN']
});

// PATCH - Update user's permissions
export const PATCH = apiHandler(async (_req, params, body) => {
    const { userId } = await params;
    const { permissions } = updatePermissionsSchema.parse(body);

    await UserService.updateUserPermissions(userId, permissions);

    return Response.json({ message: 'Permissions updated successfully' });
}, {
    roles: ['SUPER_ADMIN', 'ADMIN'],
    audit: { action: 'UPDATE_USER_PERMISSIONS', entity: 'User' }
});
