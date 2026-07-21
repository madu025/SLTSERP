import { apiHandler } from '@/lib/api-handler';
import { ProjectGISPRService } from '@/services/project/project-gis-pr.service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const generatePRSchema = z.object({
    requestedById: z.string().min(1),
    priority: z.string().optional(),
    requiredDate: z.string().optional(),
    deliveryLocation: z.string().optional(),
    remarks: z.string().optional(),
});

export const POST = apiHandler(async (_request, params, body) => {
    const { id: projectId, routeId } = params;
    const data = generatePRSchema.parse(body);
    const result = await ProjectGISPRService.generatePR(projectId, routeId, data);
    return Response.json(result, { status: 201 });
}, {
    audit: { action: 'CREATE', entity: 'GIS_PR' },
    rawResponse: true
});