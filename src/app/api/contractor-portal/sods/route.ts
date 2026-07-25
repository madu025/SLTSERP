import { apiHandler } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';
import { ServiceOrderService } from '@/services/sod.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req: Request) => {
    const userId = req.headers.get('x-user-id');
    let contractorId: string | null = req.headers.get('x-contractor-id');

    if (!contractorId && userId) {
        const currentUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { contractorId: true }
        });
        contractorId = currentUser?.contractorId || null;
    }

    if (!contractorId) {
        // Only SUPER_ADMIN can query without a contractorId (but they must provide it via query param or headers if they want specific data)
        const currentUser = await prisma.user.findUnique({ where: { id: userId || '' } });
        if (currentUser && (currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'ADMIN')) {
             // Let them proceed, but without a contractorId, getContractorAssignedSODs will return empty or throw
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
    roles: ['SUPER_ADMIN', 'ADMIN', 'CONTRACTOR_SUPERVISOR', 'CONTRACTOR_TECHNICIAN'],
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
    roles: ['SUPER_ADMIN', 'ADMIN', 'CONTRACTOR_SUPERVISOR', 'CONTRACTOR_TECHNICIAN'],
});
