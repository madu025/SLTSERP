import { apiHandler } from '@/lib/api-handler';
import { UserAdminService } from '@/services/hr/user-admin.service';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ password: z.string().min(1).max(128) }).strict();

/** An administrator sets a temporary password: it must follow the password policy, the person must change it at the next sign-in, and open sessions end. */
export const POST = apiHandler<unknown, z.infer<typeof bodySchema>>(async (_request, params, body) => {
    const actor = params._userId;
    if (!actor) throw AppError.unauthorized('Authenticated administrator required');
    await UserAdminService.resetPassword(params.id, body.password, actor);
    return { message: 'Password reset. The user must choose a new one at the next sign-in.' };
}, {
    permissions: [RBAC_PERMISSIONS.ADMIN_RBAC],
    schema: bodySchema,
    audit: { action: 'USER_PASSWORD_RESET', entity: 'User' },
});
