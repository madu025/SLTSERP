import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { apiHandler } from '@/lib/api-handler';
import { assertProjectAccess } from '@/lib/project-access';
import { getAccessibleProjectIds } from '@/lib/project-record-access';
import { AppError } from '@/lib/error';
import { ProjectPermitService } from '@/services/project/project-permit.service';
import { z } from 'zod';

const createSchema = z.object({
    projectId: z.string().min(1), permitTypeId: z.string().min(1),
    permitNumber: z.string().nullish(), applicationDate: z.union([z.string(), z.date()]).nullish(),
    expiryDate: z.union([z.string(), z.date()]).nullish(), status: z.string().optional(),
    cost: z.number().nullish(), remarks: z.string().nullish(), appliedById: z.string().nullish(),
});

export const dynamic = 'force-dynamic';

// GET permits list (rawResponse for compatibility)
export const GET = apiHandler(async (req, params) => {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (projectId) {
        await assertProjectAccess(projectId, params._userId);
        return await ProjectPermitService.getPermits(projectId);
    }

    // No project filter: restrict to projects inside the caller's OPMC scope.
    const accessible = await getAccessibleProjectIds(params._userId);
    const permits = await ProjectPermitService.getPermits(null);
    return accessible === undefined ? permits : permits.filter((p) => accessible.has(p.projectId));
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_READ],
    rawResponse: true
});

// POST create permit
export const POST = apiHandler(async (req, params, body) => {
    const { projectId, permitTypeId } = body;

    if (!projectId || !permitTypeId) {
        throw AppError.badRequest("Missing required fields: projectId, permitTypeId");
    }

    await assertProjectAccess(projectId as string, params._userId);
    return await ProjectPermitService.createPermit(createSchema.parse(body));
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_WRITE],
    audit: { action: 'CREATE', entity: 'PROJECT_PERMIT' },
    rawResponse: true
});
