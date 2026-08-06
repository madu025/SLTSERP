import { apiHandler } from '@/lib/api-handler';
import { ServiceOrderService } from '@/services/service-order/sod.service';
import { ROLE_GROUPS } from '@/config/roles';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request, params) => {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'ALL';
    const rtom = searchParams.get('rtom') || 'ALL';
    const region = searchParams.get('region') || 'ALL';
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    // Server-side OPMC scope: regionally-scoped users only see PAT results
    // for their accessible RTOMs; client rtom/region params are intersected
    // with that scope inside the query service (admins unrestricted).
    const scope = await resolveOpmcScope(params._userId);
    const accessibleRtoms = scope === undefined
        ? undefined
        : scope.length > 0
            ? (await prisma.oPMC.findMany({ where: { id: { in: scope } }, select: { rtom: true } })).map(o => o.rtom)
            : [];

    return await ServiceOrderService.getPatResults({
        page,
        limit,
        search,
        status,
        rtom,
        region,
        startDate,
        endDate,
        accessibleRtoms
    });
}, { roles: ROLE_GROUPS.ALL_OPS, rawResponse: true });
