import { apiHandler } from '@/lib/api-handler';
import { ProjectPermitService } from '@/services/project/project-permit.service';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { userHasPermission } from '@/lib/user-permissions';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const { id: projectId, permitId } = await params;
    const permit = await ProjectPermitService.getPermit(projectId, permitId);

    if (!permit) {
        throw AppError.notFound('Permit not found');
    }

    return permit;
}, { permissions: [RBAC_PERMISSIONS.PROJECT_READ], rawResponse: true });

export const PATCH = apiHandler(async (_request, params, body) => {
    const { id: projectId, permitId } = await params;

    const existing = await ProjectPermitService.getPermit(projectId, permitId);
    if (!existing) {
        throw AppError.notFound('Permit not found');
    }
    const requiredPermission = body.status === 'APPROVED'
        ? RBAC_PERMISSIONS.PROJECT_APPROVE
        : RBAC_PERMISSIONS.PROJECT_WRITE;
    if (!await userHasPermission(params._userId, requiredPermission)) {
        throw AppError.forbidden(`${requiredPermission} is required to update this permit`);
    }

    const updateData: Record<string, unknown> = {};
    if (body.status) updateData.status = body.status;
    if (body.permitNumber) updateData.permitNumber = body.permitNumber;
    if (body.submittedDate) updateData.submittedDate = new Date(body.submittedDate as string | number | Date);
    if (body.approvedDate) updateData.approvedDate = new Date(body.approvedDate as string | number | Date);
    if (body.expiryDate) updateData.expiryDate = new Date(body.expiryDate as string | number | Date);
    if (body.rejectionReason !== undefined) updateData.rejectionReason = body.rejectionReason;
    if (body.approvalDocument) updateData.approvalDocument = body.approvalDocument;
    if (body.status === 'APPROVED') updateData.approvedById = params._userId;
    if (body.cost) updateData.cost = parseFloat(String(body.cost));
    if (body.remarks !== undefined) updateData.remarks = body.remarks;

    return await ProjectPermitService.updatePermit(permitId, updateData);
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_WRITE, RBAC_PERMISSIONS.PROJECT_APPROVE],
    audit: { action: 'UPDATE', entity: 'PROJECT_PERMIT' },
    rawResponse: true
});

export const DELETE = apiHandler(async (_request, params) => {
    const { id: projectId, permitId } = await params;

    const existing = await ProjectPermitService.getPermit(projectId, permitId);
    if (!existing) {
        throw AppError.notFound('Permit not found');
    }

    await ProjectPermitService.deletePermit(permitId);
    return { success: true };
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_APPROVE],
    audit: { action: 'DELETE', entity: 'PROJECT_PERMIT' },
    rawResponse: true
});
