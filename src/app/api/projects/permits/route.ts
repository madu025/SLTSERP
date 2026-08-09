import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { ProjectPermitService } from '@/services/project/project-permit.service';

export const dynamic = 'force-dynamic';

// GET permits list (rawResponse for compatibility)
export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    return await ProjectPermitService.getPermits(projectId);
}, {
    rawResponse: true
});

// POST create permit
export const POST = apiHandler(async (req, _params, body) => {
    const { projectId, permitTypeId } = body;

    if (!projectId || !permitTypeId) {
        throw AppError.badRequest("Missing required fields: projectId, permitTypeId");
    }

    return await ProjectPermitService.createPermit(body as any);
}, {
    roles: ROLE_GROUPS.PROJECT_MANAGERS,
    audit: { action: 'CREATE', entity: 'PROJECT_PERMIT' },
    rawResponse: true
});