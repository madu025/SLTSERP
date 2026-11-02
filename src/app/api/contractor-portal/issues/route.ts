import { getAuthenticatedUserId } from '@/lib/request-context';
import { getRequestAuth } from '@/lib/request-context';
import { apiHandler } from '@/lib/api-handler';


import { ContractorInventoryService } from '@/services/inventory/contractor-inventory.service';
import { ContractorService } from '@/services/contractor/contractor.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req: Request) => {
    const userId = getAuthenticatedUserId();
    const context = await ContractorService.resolveContractorContext(userId, getRequestAuth().contractorId);
    const contractorId = context.contractorId;

    if (!contractorId) return [];

    return await ContractorInventoryService.getMaterialIssues(contractorId);
}, {
});
