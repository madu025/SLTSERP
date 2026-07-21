import { apiHandler } from '@/lib/api-handler';
import { GISReconciliationService } from '@/services/GISReconciliationService';

export const dynamic = 'force-dynamic';

export const POST = apiHandler(async (request, params) => {
    const userId = request.headers.get('x-user-id') || 'system';
    const { id: projectId } = params;

    const result = await GISReconciliationService.reconcile(projectId, userId);

    return Response.json(result);
}, {
    audit: { action: 'RECONCILE', entity: 'PROJECT_GIS' },
    rawResponse: true
});
