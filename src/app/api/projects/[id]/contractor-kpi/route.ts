import { apiHandler } from '@/lib/api-handler';
import { ContractorKPIService } from '@/services/contractor-kpi.service';

import { AppError } from '@/lib/error';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const { id: projectId } = params;
    return await ContractorKPIService.getForProject(projectId);
}, { rawResponse: true });

const calculateKPISchema = z.object({
    month: z.string().optional().nullable(), // "YYYY-MM" format
});

export const POST = apiHandler(async (_request, params, body) => {
    const { id: projectId } = params;
    const data = calculateKPISchema.parse(body);
    const contractorId = await ContractorKPIService.getProjectContractorId(projectId);

    if (!contractorId) {
        throw AppError.notFound('No contractor assigned to this project');
    }

    const evaluationMonth = data.month || new Date().toISOString().substring(0, 7);
    const score = await ContractorKPIService.calculateMonthlyScore(
        contractorId,
        evaluationMonth,
        projectId
    );

    return Response.json(
        { message: `KPI calculated for ${evaluationMonth}`, score },
        { status: 201 }
    );
}, {
    audit: { action: 'UPDATE', entity: 'CONTRACTOR_KPI' },
    rawResponse: true
});