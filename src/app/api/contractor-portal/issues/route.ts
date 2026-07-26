import { apiHandler } from '@/lib/api-handler';


import { ContractorInventoryService } from '@/services/inventory/contractor-inventory.service';
import { ContractorService } from '@/services/contractor.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req: Request) => {
    const userId = req.headers.get('x-user-id');
    const context = await ContractorService.resolveContractorContext(userId, req.headers.get('x-contractor-id'));
    const contractorId = context.contractorId;

    if (!contractorId) return [];

    return await ContractorInventoryService.getMaterialIssues(contractorId);
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'CONTRACTOR_SUPERVISOR', 'CONTRACTOR_TECHNICIAN', 'STORES_MANAGER'],
});
