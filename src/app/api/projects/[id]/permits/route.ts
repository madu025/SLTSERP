import { apiHandler } from '@/lib/api-handler';
import { ProjectPermitService } from '@/services/project/project-permit.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request, params) => {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    return await ProjectPermitService.getPermits(params.id, status);
}, { rawResponse: true });

export const POST = apiHandler(async (_request, params, body) => {
    const permitTypeId = body.permitTypeId as string | undefined;
    const applicationDate = body.applicationDate as string | Date | undefined;
    const cost = body.cost as string | undefined;
    const remarks = body.remarks as string | undefined;
    const appliedById = body.appliedById as string | undefined;

    if (!permitTypeId) {
        throw AppError.badRequest('permitTypeId is required');
    }

    return await ProjectPermitService.createPermit({
        projectId: params.id,
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
