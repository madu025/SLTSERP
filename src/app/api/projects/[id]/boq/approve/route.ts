import { apiHandler } from '@/lib/api-handler';
import { ProjectBOQApprovalService } from '@/services/project/project-boq-approval.service';
import { AppError } from '@/lib/error';
import { ROLE_GROUPS } from '@/config/roles';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request, params) => {
    const { id: projectId } = params;
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
        throw AppError.unauthorized('Unauthorized');
    }

    return await ProjectBOQApprovalService.getApprovalStatus(projectId);
}, { roles: ROLE_GROUPS.PROJECT_READERS, rawResponse: true });

export const POST = apiHandler(async (request, params, body) => {
    const { id: projectId } = params;
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
        throw AppError.unauthorized('Unauthorized');
    }

    const action = body.action as string | undefined;
    const notes = body.notes as string | undefined;

    if (action === 'submit') {
        const result = await ProjectBOQApprovalService.submitForApproval(projectId, notes);
        return Response.json(result, { status: 201 });
    }

    if (action === 'approve') {
        return await ProjectBOQApprovalService.approve(projectId, userId, notes);
    }

    if (action === 'reject') {
        return await ProjectBOQApprovalService.reject(projectId, userId, notes ?? '');
    }

    if (action === 'revise') {
        const result = await ProjectBOQApprovalService.revise(projectId, userId, notes);
        return Response.json(result, { status: 201 });
    }

    throw AppError.badRequest('Invalid action. Use: submit, approve, reject, revise');
}, {
    roles: [...new Set([...ROLE_GROUPS.PROJECT_MANAGERS, ...ROLE_GROUPS.FINANCE, ...ROLE_GROUPS.OSP_PROJECTS])],
    audit: { action: 'APPROVE_BOQ', entity: 'PROJECT_BOQ' },
    rawResponse: true
});
