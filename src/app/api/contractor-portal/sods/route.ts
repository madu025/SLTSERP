import { apiHandler } from '@/lib/api-handler';
import { ContractorService } from '@/services/contractor.service';
import { ServiceOrderService } from '@/services/sod.service';
import { AppError } from '@/lib/error';
import { ROLE_GROUPS } from '@/config/roles';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req: Request) => {
    const userId = req.headers.get('x-user-id');
    const context = await ContractorService.resolveContractorContext(userId, req.headers.get('x-contractor-id'));
    const contractorId = context.contractorId;

    if (!contractorId) {
        if (context.role && (ROLE_GROUPS.ADMINS as readonly string[]).includes(context.role)) {
             return { sods: [], total: 0, page: 1, limit: 50, totalPages: 0 };
        }
        throw AppError.forbidden('User does not have an assigned Contractor profile.');
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
    roles: [...ROLE_GROUPS.ADMINS, 'CONTRACTOR_SUPERVISOR', 'CONTRACTOR_TECHNICIAN'],
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

    return await ServiceOrderService.patchServiceOrder(id, updateData, userId);
}, {
    roles: [...ROLE_GROUPS.ADMINS, 'CONTRACTOR_SUPERVISOR', 'CONTRACTOR_TECHNICIAN'],
});
