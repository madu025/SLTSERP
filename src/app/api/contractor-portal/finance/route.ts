import { apiHandler } from '@/lib/api-handler';
import { ContractorFinanceService } from '@/services/contractor-portal/finance.service';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_req: Request, params) => {
    const userId = params._userId;
    const contractorId: string | null = params._contractorId;

    const data = await ContractorFinanceService.getFinanceDashboard(userId, contractorId);
    return data;
}, {
    permissions: [RBAC_PERMISSIONS.CONTRACTOR_READ],
});
