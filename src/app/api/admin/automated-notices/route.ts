import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { AutomatedNoticesService } from '@/services/admin/automated-notices.service';
import { databaseUuidSchema } from '@/lib/validations/uuid.schema';

export const dynamic = 'force-dynamic';

const PERMISSIONS = [RBAC_PERMISSIONS.ADMIN_RBAC];

// GET /api/admin/automated-notices - what the system sends by itself (scheduled reports and alerts) and the audiences with who is in them now
export const GET = apiHandler(async () => AutomatedNoticesService.overview(), { permissions: PERMISSIONS });

const bodySchema = z.object({
    audience: z.string().min(1).max(60),
    roleId: databaseUuidSchema,
    grant: z.boolean(),
});

// POST /api/admin/automated-notices - add a role to an audience, or take it out (audited)
export const POST = apiHandler(async (_req, params, body) => AutomatedNoticesService.setRole(params._userId ?? '', body.audience, body.roleId, body.grant), {
    schema: bodySchema,
    permissions: PERMISSIONS,
});
