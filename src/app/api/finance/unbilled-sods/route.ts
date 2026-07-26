import { apiHandler } from '@/lib/api-handler';
import { BillingService } from '@/services/finance/billing.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req) => {
    const url = new URL(req.url);
    const contractorId = url.searchParams.get('contractorId');
    
    // We pass it to the service, it will throw AppError if missing.
    // Let's pass it cleanly.
    return await BillingService.getUnbilledSods(contractorId as string);
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'FINANCE_ASSISTANT']
});
