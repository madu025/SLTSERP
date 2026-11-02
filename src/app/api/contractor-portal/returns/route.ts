import { getAuthenticatedUserId } from '@/lib/request-context';
import { getRequestAuth } from '@/lib/request-context';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';


import { ContractorInventoryService } from '@/services/inventory/contractor-inventory.service';
import { ContractorService } from '@/services/contractor/contractor.service';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

export const dynamic = 'force-dynamic';

// GET /api/contractor-portal/returns - List contractor material return notes
export const GET = apiHandler(async (req: Request) => {
    const userId = getAuthenticatedUserId();
    const context = await ContractorService.resolveContractorContext(userId, getRequestAuth().contractorId);
    const contractorId = context.contractorId;

    if (!contractorId) return [];

    return await ContractorInventoryService.getMaterialReturns(contractorId);
}, {
    permissions: [RBAC_PERMISSIONS.CONTRACTOR_READ],
});

// POST /api/contractor-portal/returns - Create a new Material Return Note (MRN) request
export const POST = apiHandler(async (req: Request) => {
    const userId = getAuthenticatedUserId();
    const body = await req.json();

    const context = await ContractorService.resolveContractorContext(userId, getRequestAuth().contractorId);
    const contractorId = context.contractorId;

    if (!contractorId) {
        throw AppError.unauthorized('Contractor identity not found');
    }

    return await ContractorInventoryService.createMaterialReturn(contractorId, body);
}, {
    permissions: [RBAC_PERMISSIONS.CONTRACTOR_WRITE],
});
