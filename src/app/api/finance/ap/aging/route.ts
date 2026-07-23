import { apiHandler } from '@/lib/api-handler';
import { ArApService } from '@/services/finance/ar-ap.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async () => {
    const report = await ArApService.getApAgingReport();
    return report;
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'FINANCE_ASSISTANT']
});
