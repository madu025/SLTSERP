export const dynamic = 'force-dynamic';

import { apiHandler } from '@/lib/api-handler';
import { UserService } from '@/services/hr/user.service';
import { z } from 'zod';
import { AppError } from '@/lib/error';
import { isCanonicalPermission, RBAC_PERMISSIONS } from '@/config/rbac-permissions';

const updatePermissionsSchema = z.object({
    permissions: z.array(z.string()).min(1, 'Permissions must be a non-empty array')
});

// GET - Fetch user's permissions
export const GET = apiHandler(async (_req, params) => {
    const permissions = await UserService.getUserPermissions(params.userId);
    return Response.json(permissions);
}, {
});

// PATCH - Update user's permissions
// Direct permission grants bypass the role model — SUPER_ADMIN only.
export const PATCH = apiHandler(async (_req, params, body) => {
    const permissions = body.permissions as string[];
    const callerPermissions = (params._permissions ?? []) as string[];
    const unknown = permissions.filter((code) => !isCanonicalPermission(code));
    if (unknown.length > 0) {
        throw AppError.badRequest(`Unknown permission code(s): ${unknown.slice(0, 5).join(', ')}`);
    }
    // Nobody can hand out a capability they do not hold; admin.super additionally needs admin.super itself
    const notHeld = permissions.filter((code) => !callerPermissions.includes(code));
    if (notHeld.length > 0 && !callerPermissions.includes(RBAC_PERMISSIONS.ADMIN_SUPER)) {
        throw AppError.forbidden(`You cannot grant permissions you do not hold: ${notHeld.slice(0, 5).join(', ')}`);
    }
    await UserService.updateUserPermissions(params.userId, permissions);
    return Response.json({ message: 'Permissions updated successfully' });
}, {
    schema: updatePermissionsSchema,
    audit: { action: 'UPDATE_USER_PERMISSIONS', entity: 'User' }
});
