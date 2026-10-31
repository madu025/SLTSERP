import { apiHandler } from '@/lib/api-handler';
import { ProjectApprovalService } from '@/services/project/project-approval.service';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { AppError } from '@/lib/error';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
export const GET = apiHandler(async (_request, params) => {
    const { id: projectId } = params;
    return await ProjectApprovalService.getApprovals(projectId, params._userId);
}, { permissions: [RBAC_PERMISSIONS.PROJECT_READ], rawResponse: true });
const createApprovalSchema = z.object({
    type: z.string().min(1),
    referenceId: z.string().min(1),
    title: z.string().min(1),
    description: z.string().optional().nullable(),
    amount: z.number().optional().nullable(),
    steps: z.array(z.object({
        stepNumber: z.number().min(1),
        roleRequired: z.string().min(1),
        assignedUserId: z.string().optional().nullable(),
    })).min(1),
});
export const POST = apiHandler(async (_request, params, body) => {
    const { id: projectId } = params;
    const data = createApprovalSchema.parse(body);
    const newRequest = await ProjectApprovalService.createApproval({
        projectId,
        ...data,
    }, params._userId);
    return Response.json(newRequest, { status: 201 });
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_WRITE],
    audit: { action: 'CREATE', entity: 'APPROVAL_REQUEST' },
    rawResponse: true
});
const processStepSchema = z.object({
    stepId: z.string().min(1),
    action: z.enum(['APPROVED', 'REJECTED']),
    comment: z.string().optional().nullable(),
});
export const PATCH = apiHandler(async (_request, params, body) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    const data = processStepSchema.parse(body);
    return await ProjectApprovalService.processApprovalStep(data.stepId, data.action, params._userId, data.comment, params.id);
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_APPROVE],
    audit: { action: 'UPDATE', entity: 'APPROVAL_STEP' },
    rawResponse: true
});
