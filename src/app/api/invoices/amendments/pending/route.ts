import { apiHandler } from '@/lib/api-handler';
import { PricingAuditService } from '@/services/sf-audit/pricing-audit.service';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(
    async () => {
        return await PricingAuditService.getPendingAmendmentRequests();
    },
    { permissions: [RBAC_PERMISSIONS.FINANCE_AUDIT] }
);
