import { getAuthenticatedUserId } from '@/lib/request-context';
import { getRequestAuth } from '@/lib/request-context';
import { apiHandler } from '@/lib/api-handler';
import { ContractorService } from '@/services/contractor/contractor.service';
import { ServiceOrderService } from '@/services/service-order/sod.service';
import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

export const dynamic = 'force-dynamic';

const CONTRACTOR_EDITABLE_FIELDS = [
    'sltsStatus', 'completedDate', 'dropWireDistance', 'ontSerialNumber', 'materialUsage',
    'iptvSerialNumbers', 'erectedPoles', 'collectedCpes', 'comments',
] as const;

export const GET = apiHandler(async (req: Request) => {
    const userId = getAuthenticatedUserId();
    const context = await ContractorService.resolveContractorContext(userId, getRequestAuth().contractorId);
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
    const userId = getAuthenticatedUserId() || undefined;
    const body = await req.json();
    const { id } = body;

    if (!id) {
        throw AppError.badRequest('Service Order ID required');
    }

    // A contractor may only act on service orders assigned to its own contractor account.
    const context = await ContractorService.resolveContractorContext(userId, getRequestAuth().contractorId);
    if (!context.contractorId) throw AppError.forbidden('CONTRACTOR_ACCOUNT_REQUIRED');
    const order = await prisma.serviceOrder.findUnique({ where: { id }, select: { contractorId: true } });
    if (!order) throw AppError.notFound('SERVICE_ORDER_NOT_FOUND');
    if (order.contractorId !== context.contractorId) throw AppError.forbidden('SOD_NOT_ASSIGNED_TO_CONTRACTOR');

    // Field-entry whitelist: contractors cannot reassign the order, change its source or set other statuses.
    const updateData: Record<string, unknown> = {};
    for (const key of CONTRACTOR_EDITABLE_FIELDS) if (body[key] !== undefined) updateData[key] = body[key];
    if (updateData.sltsStatus !== undefined && updateData.sltsStatus !== 'COMPLETED') {
        throw AppError.forbidden('CONTRACTOR_CAN_ONLY_COMPLETE_SOD');
    }

    return await ServiceOrderService.updateServiceOrder(id, updateData, userId);
}, {
    permissions: [RBAC_PERMISSIONS.CONTRACTOR_WRITE],
});
