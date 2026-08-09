import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';


import { ContractorInventoryService } from '@/services/inventory/contractor-inventory.service';
import { ContractorService } from '@/services/contractor/contractor.service';

export const dynamic = 'force-dynamic';

// GET /api/contractor-portal/returns - List contractor material return notes
export const GET = apiHandler(async (req: Request) => {
    const userId = req.headers.get('x-user-id');
    const context = await ContractorService.resolveContractorContext(userId, req.headers.get('x-contractor-id'));
    const contractorId = context.contractorId;

    if (!contractorId) return [];

    return await ContractorInventoryService.getMaterialReturns(contractorId);
}, {
    roles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.CONTRACTORS],
});

// POST /api/contractor-portal/returns - Create a new Material Return Note (MRN) request
export const POST = apiHandler(async (req: Request) => {
    const userId = req.headers.get('x-user-id');
    const body = await req.json();

    const context = await ContractorService.resolveContractorContext(userId, req.headers.get('x-contractor-id'));
    const contractorId = context.contractorId;

    if (!contractorId) {
        throw AppError.unauthorized('Contractor identity not found');
    }

    return await ContractorInventoryService.createMaterialReturn(contractorId, body);
}, {
    roles: [...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.CONTRACTORS],
});
