import { apiHandler } from '@/lib/api-handler';
import { ProjectGISPRService } from '@/services/project/project-gis-pr.service';
import { z } from 'zod';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

const generatePRSchema = z.object({
    priority: z.string().optional(),
    requiredDate: z.string().optional(),
    deliveryLocation: z.string().optional(),
    remarks: z.string().optional(),
}).strict();

export const POST = apiHandler(async (_request, params, body) => {
    const { id: projectId, routeId } = params;
    const data = generatePRSchema.parse(body);
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    const result = await ProjectGISPRService.generatePR(projectId, routeId, data, params._userId);
    return Response.json(result, { status: 201 });
}, {
    audit: { action: 'CREATE', entity: 'GIS_PR' },
    rawResponse: true
});
