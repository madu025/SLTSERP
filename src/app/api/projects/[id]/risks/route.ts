import { apiHandler } from '@/lib/api-handler';
import { ProjectRiskService } from '@/services/project/project-risk.service';
import { assertRecordInProject } from '@/lib/project-record-access';
import { AppError } from '@/lib/error';
import { z } from 'zod';

const createRiskSchema = z.object({
    title: z.string().trim().min(1).max(300),
    description: z.string().trim().min(1).max(5000),
    probability: z.number().int().min(1).max(5),
    impact: z.number().int().min(1).max(5),
    mitigationPlan: z.string().max(5000).optional(),
}).strict();
const updateRiskSchema = z.object({
    riskId: z.string().min(1),
    mitigationPlan: z.string().max(5000).optional(),
    status: z.string().trim().max(32).optional(),
}).strict();

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const { id: projectId } = params;
    return await ProjectRiskService.getRisks(projectId);
}, { rawResponse: true });

export const POST = apiHandler(async (_request, params, body) => {
    const { id: projectId } = params;
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');

    const newRisk = await ProjectRiskService.createRisk(
        projectId, 
        { ...body, identifiedById: userId },
        userId,
    );
    return Response.json(newRisk, { status: 201 });
}, {
    schema: createRiskSchema,
    audit: { action: 'CREATE', entity: 'PROJECT_RISK' },
    rawResponse: true
});

export const PATCH = apiHandler(async (_request, params, body) => {
    const { riskId } = body;

    if (!riskId) {
        throw AppError.badRequest('Risk ID is required');
    }

    await assertRecordInProject('risk', riskId as string, params.id);
    return await ProjectRiskService.updateRisk(
        riskId as string, 
        { mitigationPlan: body.mitigationPlan, status: body.status }
    );
}, {
    schema: updateRiskSchema,
    audit: { action: 'UPDATE', entity: 'PROJECT_RISK' },
    rawResponse: true
});
