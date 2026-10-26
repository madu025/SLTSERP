import { apiHandler } from '@/lib/api-handler';
import { ContractorService } from '@/services/contractor/contractor.service';
import { ServiceOrderService } from '@/services/service-order/sod.service';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req: Request) => {
    const userId = req.headers.get('x-user-id');
    const context = await ContractorService.resolveContractorContext(userId, req.headers.get('x-contractor-id'));
    const contractorId = context.contractorId;

    if (!contractorId) {
        return { sods: [], total: 0, page: 1, limit: 50, totalPages: 0 };
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || undefined;
    const sltsStatus = searchParams.get('status') || undefined;
    const teamId = searchParams.get('teamId') || undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    return ServiceOrderService.getContractorAssignedSODs({
        contractorId,
        search,
        sltsStatus,
        teamId,
        page,
        limit
    });
}, {
    permissions: [RBAC_PERMISSIONS.CONTRACTOR_READ],
});

/**
 * PATCH: Complete SOD or log field installation details by Contractor
 */
export const PATCH = apiHandler(async (req: Request) => {
    const userId = req.headers.get('x-user-id') || undefined;
    const body = await req.json();
    const { id, ...updateData } = body;

    if (!id) {
        throw AppError.badRequest('Service Order ID required');
    }

    return await ServiceOrderService.updateServiceOrder(id, updateData, userId);
}, {
    permissions: [RBAC_PERMISSIONS.CONTRACTOR_WRITE],
});
