import { ServiceOrderDashboardService } from '@/services/service-order/sod-dashboard.service';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const userId = params._userId;
    if (!userId) {
        throw AppError.unauthorized('Unauthorized');
    }

    return ServiceOrderDashboardService.getDashboardFilterMetadata(userId);
}, {
    permissions: [RBAC_PERMISSIONS.SOD_READ],
    rawResponse: true
});
