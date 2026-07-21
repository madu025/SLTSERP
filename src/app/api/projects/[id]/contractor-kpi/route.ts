import { apiHandler } from '@/lib/api-handler';
import { ContractorKPIService } from '@/services/contractor-kpi.service';
import { prisma } from '@/lib/prisma';
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
    
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { contractorId: true },
    });

    if (!project?.contractorId) {
        throw AppError.notFound('No contractor assigned to this project');
    }

    const evaluationMonth = data.month || new Date().toISOString().substring(0, 7);
    const score = await ContractorKPIService.calculateMonthlyScore(
        project.contractorId,
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