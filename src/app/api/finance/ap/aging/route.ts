import { apiHandler } from '@/lib/api-handler';
import { ArApService } from '@/services/finance/ar-ap.service';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const report = await ArApService.getApAgingReport(params._userId);
    return report;
}, {
    permissions: [RBAC_PERMISSIONS.FINANCE_READ]
});
