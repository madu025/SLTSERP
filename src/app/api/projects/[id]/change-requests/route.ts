import { apiHandler } from '@/lib/api-handler';
import { ChangeRequestService } from '@/services/project/change-request.service';
import { z } from 'zod';
import { AppError } from '@/lib/error';
import { assertProjectAccess } from '@/lib/project-access';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const { id: projectId } = params;
    await assertProjectAccess(projectId, params._userId);
    return await ChangeRequestService.getForProject(projectId);
}, { permissions: [RBAC_PERMISSIONS.PROJECT_READ], rawResponse: true });

const createChangeRequestSchema = z.object({
    changeType: z.enum(['MATERIAL', 'SCOPE', 'ROUTE', 'TIMELINE', 'BUDGET']),
    title: z.string().min(1),
    description: z.string().optional(),
    costImpact: z.number().optional(),
    timeImpact: z.number().optional(),
    routeChangeData: z.record(z.string(), z.unknown()).optional(),
});

export const POST = apiHandler(async (_request, params, body) => {
    const { id: projectId } = params;
    const userId = params._userId;
    
    if (!userId) throw AppError.unauthorized('Unauthorized');
    await assertProjectAccess(projectId, userId);

    const data = createChangeRequestSchema.parse(body);

    const result = await ChangeRequestService.create({
        projectId,
        ...data,
        requestedById: userId,
    });

    return Response.json(result, { status: 201 });
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_WRITE],
    audit: { action: 'CREATE', entity: 'CHANGE_REQUEST' },
    rawResponse: true
});
