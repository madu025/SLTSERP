import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';
import { ConsumableAuditService } from '@/services/inventory/consumable-audit.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const contractorId = searchParams.get('contractorId');

    if (!contractorId) {
        throw AppError.badRequest('contractorId parameter is required for consumable leakage audit.');
    }

    const auditSummary = await ConsumableAuditService.auditContractorConsumableLeakage(contractorId);

    return {
        success: true,
        timestamp: new Date().toISOString(),
        data: auditSummary,
    };
}, {
    roles: ROLE_GROUPS.FINANCE_APPROVERS,
    audit: { action: 'AUDIT_CONSUMABLE_LEAKAGE', entity: 'Contractor' }
});
