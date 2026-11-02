import { getAuthenticatedUserId } from '@/lib/request-context';
import { apiHandler } from '@/lib/api-handler';
import { GISReconciliationService } from '@/services/gis/GISReconciliationService';

export const dynamic = 'force-dynamic';

export const POST = apiHandler(async (request, params) => {
    const userId = getAuthenticatedUserId() || 'system';
    const { id: projectId } = params;

    const result = await GISReconciliationService.reconcile(projectId, userId);

    return Response.json(result);
}, {
    audit: { action: 'RECONCILE', entity: 'PROJECT_GIS' },
    rawResponse: true
});
