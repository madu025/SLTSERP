import { apiHandler } from '@/lib/api-handler';
import { ChangeRequestService } from '@/services/change-request.service';
import { z } from 'zod';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const { id: projectId } = params;
    return await ChangeRequestService.getForProject(projectId);
}, { rawResponse: true });

const createChangeRequestSchema = z.object({
    changeType: z.enum(['MATERIAL', 'SCOPE', 'ROUTE', 'TIMELINE', 'BUDGET']),
    title: z.string().min(1),
    description: z.string().optional(),
    costImpact: z.number().optional(),
    timeImpact: z.number().optional(),
    routeChangeData: z.record(z.string(), z.unknown()).optional(),
});

export const POST = apiHandler(async (request, params, body) => {
    const { id: projectId } = params;
    const userId = request.headers.get('x-user-id');
    
    if (!userId) throw AppError.unauthorized('Unauthorized');

    const data = createChangeRequestSchema.parse(body);

    const result = await ChangeRequestService.create({
        projectId,
        ...data,
        requestedById: userId,
    });

    return Response.json(result, { status: 201 });
}, {
    audit: { action: 'CREATE', entity: 'CHANGE_REQUEST' },
    rawResponse: true
});