import { apiHandler } from '@/lib/api-handler';
import { ProjectPermitService } from '@/services/project-permit.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request, params) => {
    const { id: projectId } = await params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    return await ProjectPermitService.getPermits(projectId, status);
}, { rawResponse: true });

export const POST = apiHandler(async (_request, params, body) => {
    const { id: projectId } = await params;
    const { permitTypeId, applicationDate, cost, remarks, appliedById } = body || {};

    if (!permitTypeId) {
        throw AppError.badRequest('permitTypeId is required');
    }

    return await ProjectPermitService.createPermit({
        projectId,
        permitTypeId,
        applicationDate,
        cost: cost ? parseFloat(cost) : null,
        remarks,
        appliedById
    });
}, {
    audit: { action: 'CREATE', entity: 'PROJECT_PERMIT' },
    rawResponse: true
});
