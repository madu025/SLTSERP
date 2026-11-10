import { apiHandler, castBody } from '@/lib/api-handler';
import { OpmcService } from '@/services/slt/opmc.service';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { resolveOpmcScope } from '@/lib/opmc-scope';

export const dynamic = 'force-dynamic';

// GET all OPMCs
export const GET = apiHandler(async (request, params) => {
    const all = await OpmcService.getAllOPMCs();
    // ?scope=mine limits the list to the OPMCs the caller may work in (used by create/assign dialogs)
    if (new URL(request.url).searchParams.get('scope') === 'mine' && Array.isArray(all)) {
        const scope = await resolveOpmcScope(params._userId);
        if (scope !== undefined) return all.filter((o: { id: string }) => scope.includes(o.id));
    }
    return all;
}, { permissions: [RBAC_PERMISSIONS.DASHBOARD_READ], rawResponse: true });

// POST new OPMC
export const POST = apiHandler(async (_request, _params, body) => {
    return await OpmcService.createOPMC(
        castBody<Parameters<typeof OpmcService.createOPMC>[0]>(body)
    );
}, {
    permissions: [RBAC_PERMISSIONS.ADMIN_RBAC],
    audit: { action: 'OPMC_CREATE', entity: 'OPMC' },
    rawResponse: true
});

// PUT update OPMC
export const PUT = apiHandler(async (_request, _params, body) => {
    const id = body.id as string | undefined;
    if (!id) throw AppError.badRequest('ID required');

    return await OpmcService.updateOPMC(
        castBody<Parameters<typeof OpmcService.updateOPMC>[0]>(body)
    );
}, {
    permissions: [RBAC_PERMISSIONS.ADMIN_RBAC],
    audit: { action: 'OPMC_UPDATE', entity: 'OPMC' },
    rawResponse: true
});

// DELETE OPMC
export const DELETE = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) throw AppError.badRequest('ID required');

    await OpmcService.deleteOPMC(id);
    return { message: 'OPMC deleted successfully' };
}, {
    permissions: [RBAC_PERMISSIONS.ADMIN_RBAC],
    audit: { action: 'OPMC_DELETE', entity: 'OPMC' },
    rawResponse: true
});
