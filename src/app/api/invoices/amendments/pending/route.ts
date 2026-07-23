import { apiHandler } from '@/lib/api-handler';
import { PricingAuditService } from '@/services/sf-audit/pricing-audit.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(
    async () => {
        return await PricingAuditService.getPendingAmendmentRequests();
    },
    { roles: ['SF_AUDIT', 'SF_AUDIT_OFFICER', 'SF_AUDIT_MANAGER', 'ADMIN', 'SUPER_ADMIN', 'FINANCE_MANAGER'] }
);
