import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';

import { ContractorInventoryService } from '@/services/inventory/contractor-inventory.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req: Request) => {
    const userId = req.headers.get('x-user-id');
    let contractorId: string | null = req.headers.get('x-contractor-id');

    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get('teamId') || undefined;
    const month = searchParams.get('month') || undefined;
    const year = searchParams.get('year') || undefined;

    const data = await ContractorInventoryService.getContractorStockDashboard(contractorId, userId, teamId, month, year);
    return data;
}, {
    roles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.CONTRACTORS],
});
