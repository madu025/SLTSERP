import { apiHandler } from '@/lib/api-handler';
import { ProjectPermitService } from '@/services/project-permit.service';

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
        throw new Error("Missing required fields: projectId, permitTypeId");
    }

    return await ProjectPermitService.createPermit(body);
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OSP_MANAGER', 'AREA_MANAGER'],
    audit: { action: 'CREATE', entity: 'PROJECT_PERMIT' },
    rawResponse: true
});