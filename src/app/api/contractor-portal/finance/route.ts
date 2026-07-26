import { apiHandler } from '@/lib/api-handler';
import { ContractorFinanceService } from '@/services/contractor-portal/finance.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req: Request) => {
    const userId = req.headers.get('x-user-id');
    let contractorId: string | null = req.headers.get('x-contractor-id');

    const data = await ContractorFinanceService.getFinanceDashboard(userId, contractorId);
    return data;
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'CONTRACTOR_SUPERVISOR', 'CONTRACTOR_TECHNICIAN', 'CONTRACTOR_FINANCE'],
});
