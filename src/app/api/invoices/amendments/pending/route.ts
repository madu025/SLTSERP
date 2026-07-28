import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';
import { PricingAuditService } from '@/services/sf-audit/pricing-audit.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(
    async () => {
        return await PricingAuditService.getPendingAmendmentRequests();
    },
    { roles: ROLE_GROUPS.SF_AUDITORS }
);
