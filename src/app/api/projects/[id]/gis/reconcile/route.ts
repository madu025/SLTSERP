import { apiHandler } from '@/lib/api-handler';
import { GISReconciliationService } from '@/services/gis/GISReconciliationService';
import { assertProjectAccess } from '@/lib/project-access';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const POST = apiHandler(async (request, params) => {
    const userId = params._userId;
    const { id: projectId } = params;
    if (!userId) throw AppError.unauthorized('Authentication required');
    await assertProjectAccess(projectId, userId);

    const result = await GISReconciliationService.reconcile(projectId, userId);

    return Response.json(result);
}, {
    audit: { action: 'RECONCILE', entity: 'PROJECT_GIS' },
    rawResponse: true
});
