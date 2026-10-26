import { apiHandler } from '@/lib/api-handler';
import { BillingService } from '@/services/finance/billing.service';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req, params) => {
    const url = new URL(req.url);
    const contractorId = url.searchParams.get('contractorId');
    const month = url.searchParams.get('month') || undefined;
    const year = url.searchParams.get('year') || undefined;
    
    // We pass it to the service, it will throw AppError if missing.
    // Let's pass it cleanly.
    return await BillingService.getUnbilledSods(contractorId as string, params._userId || '', month, year);
}, {
    permissions: [RBAC_PERMISSIONS.FINANCE_READ]
});
