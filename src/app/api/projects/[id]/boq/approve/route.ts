import { apiHandler } from '@/lib/api-handler';
import { ProjectBOQApprovalService } from '@/services/project/project-boq-approval.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request, params) => {
    const { id: projectId } = params;
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
        throw AppError.unauthorized('Unauthorized');
    }

    return await ProjectBOQApprovalService.getApprovalStatus(projectId);
}, { rawResponse: true });

export const POST = apiHandler(async (request, params, body) => {
    const { id: projectId } = params;
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
        throw AppError.unauthorized('Unauthorized');
    }

    const { action, notes } = body || {};

    if (action === 'submit') {
        const result = await ProjectBOQApprovalService.submitForApproval(projectId, notes);
        return Response.json(result, { status: 201 });
    }

    if (action === 'approve') {
        return await ProjectBOQApprovalService.approve(projectId, userId, notes);
    }

    if (action === 'reject') {
        return await ProjectBOQApprovalService.reject(projectId, notes);
    }

    if (action === 'revise') {
        const result = await ProjectBOQApprovalService.revise(projectId, notes);
        return Response.json(result, { status: 201 });
    }

    throw AppError.badRequest('Invalid action. Use: submit, approve, reject, revise');
}, {
    audit: { action: 'APPROVE_BOQ', entity: 'PROJECT_BOQ' },
    rawResponse: true
});