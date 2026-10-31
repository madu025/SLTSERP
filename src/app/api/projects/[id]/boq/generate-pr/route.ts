import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { ProjectBOQPRService } from '@/services/project/project-boq-pr.service';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

export const dynamic = 'force-dynamic';

export const POST = apiHandler(async (_request, params) => {
    const { id: projectId } = params;
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Unauthorized');

    const result = await ProjectBOQPRService.generatePR(projectId, userId);
    
    // Handle the case where no PR is generated but it's a valid 200 response
    if (result.action === 'view_existing') {
        return Response.json(result, { status: 200 });
    }
    
    if (result.message && !result.pr) {
        return Response.json(result, { status: 200 });
    }

    return Response.json(result, { status: 201 });
}, {
    permissions: [RBAC_PERMISSIONS.PROCUREMENT_WRITE],
    audit: { action: 'CREATE', entity: 'PR' },
    rawResponse: true
});

export const GET = apiHandler(async (_request, params) => {
    const { id: projectId } = params;
    return await ProjectBOQPRService.getPRGenerationStatus(projectId);
}, { permissions: [RBAC_PERMISSIONS.PROCUREMENT_READ], rawResponse: true });
