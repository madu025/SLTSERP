import { apiHandler } from '@/lib/api-handler';
import { ProjectBOQApprovalService } from '@/services/project/project-boq-approval.service';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { assertProjectAccess } from '@/lib/project-access';
import { userHasPermission } from '@/lib/user-permissions';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const { id: projectId } = params;
    await assertProjectAccess(projectId, params._userId);
    return await ProjectBOQApprovalService.getApprovalStatus(projectId);
}, { permissions: [RBAC_PERMISSIONS.PROJECT_READ], rawResponse: true });

export const POST = apiHandler(async (_request, params, body) => {
    const { id: projectId } = params;
    const userId = params._userId;
    if (!userId) {
        throw AppError.unauthorized('Unauthorized');
    }
    await assertProjectAccess(projectId, userId);

    const action = body.action as string | undefined;
    const notes = body.notes as string | undefined;
    const requiredPermission = action === 'approve' || action === 'reject'
        ? RBAC_PERMISSIONS.PROJECT_APPROVE
        : RBAC_PERMISSIONS.PROJECT_WRITE;
    if (!await userHasPermission(userId, requiredPermission)) {
        throw AppError.forbidden(`${requiredPermission} is required for this BOQ action`);
    }

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
    permissions: [RBAC_PERMISSIONS.PROJECT_WRITE, RBAC_PERMISSIONS.PROJECT_APPROVE],
    audit: { action: 'APPROVE_BOQ', entity: 'PROJECT_BOQ' },
    rawResponse: true
});
