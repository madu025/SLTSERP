import { apiHandler } from '@/lib/api-handler';
import { ContractorFinanceService } from '@/services/contractor-portal/finance.service';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req: Request) => {
    const userId = req.headers.get('x-user-id');
    const contractorId: string | null = req.headers.get('x-contractor-id');

    const data = await ContractorFinanceService.getFinanceDashboard(userId, contractorId);
    return data;
}, {
    permissions: [RBAC_PERMISSIONS.CONTRACTOR_READ],
});
