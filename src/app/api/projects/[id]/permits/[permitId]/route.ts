import { apiHandler } from '@/lib/api-handler';
import { ProjectPermitService } from '@/services/project-permit.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const { id: projectId, permitId } = await params;
    const permit = await ProjectPermitService.getPermit(projectId, permitId);

    if (!permit) {
        throw AppError.notFound('Permit not found');
    }

    return permit;
}, { rawResponse: true });

export const PATCH = apiHandler(async (_request, params, body) => {
    const { id: projectId, permitId } = await params;

    const existing = await ProjectPermitService.getPermit(projectId, permitId);
    if (!existing) {
        throw AppError.notFound('Permit not found');
    }

    const updateData: Record<string, unknown> = {};
    if (body.status) updateData.status = body.status;
    if (body.permitNumber) updateData.permitNumber = body.permitNumber;
    if (body.submittedDate) updateData.submittedDate = new Date(body.submittedDate);
    if (body.approvedDate) updateData.approvedDate = new Date(body.approvedDate);
    if (body.expiryDate) updateData.expiryDate = new Date(body.expiryDate);
    if (body.rejectionReason !== undefined) updateData.rejectionReason = body.rejectionReason;
    if (body.approvalDocument) updateData.approvalDocument = body.approvalDocument;
    if (body.approvedById) updateData.approvedById = body.approvedById;
    if (body.cost) updateData.cost = parseFloat(body.cost);
    if (body.remarks !== undefined) updateData.remarks = body.remarks;

    return await ProjectPermitService.updatePermit(permitId, updateData);
}, {
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
    audit: { action: 'DELETE', entity: 'PROJECT_PERMIT' },
    rawResponse: true
});
