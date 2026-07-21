import { apiHandler } from '@/lib/api-handler';
import { ProjectRiskService } from '@/services/project/project-risk.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const { id: projectId } = params;
    return await ProjectRiskService.getRisks(projectId);
}, { rawResponse: true });

export const POST = apiHandler(async (_request, params, body) => {
    const { id: projectId } = params;
    const { title, description, probability, impact, identifiedById } = body || {};

    if (!title || !description || !probability || !impact || !identifiedById) {
        throw AppError.badRequest('Missing required parameters');
    }

    const newRisk = await ProjectRiskService.createRisk(
        projectId, 
        body as unknown as Parameters<typeof ProjectRiskService.createRisk>[1]
    );
    return Response.json(newRisk, { status: 201 });
}, {
    audit: { action: 'CREATE', entity: 'PROJECT_RISK' },
    rawResponse: true
});

export const PATCH = apiHandler(async (_request, _params, body) => {
    const { riskId } = body || {};

    if (!riskId) {
        throw AppError.badRequest('Risk ID is required');
    }

    return await ProjectRiskService.updateRisk(
        riskId as string, 
        body as unknown as Parameters<typeof ProjectRiskService.updateRisk>[1]
    );
}, {
    audit: { action: 'UPDATE', entity: 'PROJECT_RISK' },
    rawResponse: true
});
