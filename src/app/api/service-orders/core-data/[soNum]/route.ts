import { apiHandler } from '@/lib/api-handler';
import { ServiceOrderService } from '@/services/service-order/sod.service';
import { AppError } from '@/lib/error';
import { ROLE_GROUPS } from '@/config/roles';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const { soNum } = params;
    const serviceOrder = await ServiceOrderService.getServiceOrderBySoNum(soNum);

    if (!serviceOrder) {
        throw AppError.notFound('Not found');
    }

    // OPMC membership check: regionally-scoped users may only read SODs
    // belonging to their accessible OPMCs (admins unrestricted). Matched via
    // rtom because the PAT-status fallback shape carries no opmcId.
    const scope = await resolveOpmcScope(params._userId);
    if (scope !== undefined) {
        const orderRtom = (serviceOrder as { rtom?: string | null }).rtom ?? null;
        const allowed = orderRtom
            ? await prisma.oPMC.findFirst({
                where: { rtom: orderRtom, id: { in: scope } },
                select: { id: true }
            })
            : null;
        if (!allowed) {
            throw AppError.forbidden('Service order is outside your OPMC access');
        }
    }

    return { success: true, data: serviceOrder };
}, { roles: ROLE_GROUPS.ALL_OPS, rawResponse: true });
