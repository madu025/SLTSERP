import { apiHandler } from '@/lib/api-handler';
import { OpmcService } from '@/services/opmc.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

// GET all OPMCs
export const GET = apiHandler(async () => {
    return await OpmcService.getAllOPMCs();
}, { rawResponse: true });

// POST new OPMC
export const POST = apiHandler(async (_request, _params, body) => {
    return await OpmcService.createOPMC(body);
}, {
    roles: ['ADMIN', 'SUPER_ADMIN'],
    audit: { action: 'OPMC_CREATE', entity: 'OPMC' },
    rawResponse: true
});

// PUT update OPMC
export const PUT = apiHandler(async (_request, _params, body) => {
    const { id } = body;
    if (!id) throw AppError.badRequest('ID required');

    return await OpmcService.updateOPMC(body);
}, {
    roles: ['ADMIN', 'SUPER_ADMIN'],
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
    roles: ['SUPER_ADMIN'],
    audit: { action: 'OPMC_DELETE', entity: 'OPMC' },
    rawResponse: true
});
