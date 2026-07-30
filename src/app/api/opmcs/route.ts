import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler, castBody } from '@/lib/api-handler';
import { OpmcService } from '@/services/slt/opmc.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

// GET all OPMCs
export const GET = apiHandler(async () => {
    return await OpmcService.getAllOPMCs();
}, { rawResponse: true });

// POST new OPMC
export const POST = apiHandler(async (_request, _params, body) => {
    return await OpmcService.createOPMC(
        castBody<Parameters<typeof OpmcService.createOPMC>[0]>(body)
    );
}, {
    roles: ROLE_GROUPS.ADMINS,
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
    roles: ROLE_GROUPS.ADMINS,
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
    roles: ROLE_GROUPS.ADMINS,
    audit: { action: 'OPMC_DELETE', entity: 'OPMC' },
    rawResponse: true
});
