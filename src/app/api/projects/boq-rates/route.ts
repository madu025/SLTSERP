import { apiHandler } from '@/lib/api-handler';
import { ProjectBOQService } from '@/services/project/project-boq.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const isActive = searchParams.get('isActive');

    const isActiveVal = isActive !== null && isActive !== undefined ? isActive === 'true' : undefined;
    const rates = await ProjectBOQService.getBOQRates(projectId, isActiveVal);

    // Group by scope
    const global = rates.filter((r) => r.projectId === null);
    const project = rates.filter((r) => r.projectId !== null);

    return {
        rates,
        summary: {
            total: rates.length,
            global: global.length,
            projectSpecific: project.length,
        },
        defaultTelecomCableConfig: {
            startReserve: 10,
            endReserve: 10,
            jointReserve: 5,
            maintenanceLoop: 10,
            longRouteThreshold: 500,
            routeFactorPct: 0,
        },
    };
}, { rawResponse: true });

export const POST = apiHandler(async (_request, _params, body) => {
    const { itemCode, unitRate } = body || {};

    if (!itemCode || unitRate === undefined) {
        throw AppError.badRequest('itemCode and unitRate are required');
    }

    const { rate, isNew } = await ProjectBOQService.saveBOQRate(body);
    return Response.json(rate, { status: isNew ? 201 : 200 });
}, {
    audit: { action: 'UPSERT_RATE', entity: 'PROJECT_BOQ' },
    rawResponse: true
});

export const PATCH = apiHandler(async (_request, _params, body) => {
    const { rates } = body || {};

    if (!rates || !Array.isArray(rates) || rates.length === 0) {
        throw AppError.badRequest('rates array is required');
    }

    const summary = await ProjectBOQService.bulkUpdateBOQRates(rates);

    return {
        message: `Bulk rate update: ${summary.succeeded} succeeded, ${summary.failed} failed`,
        succeeded: summary.succeeded,
        failed: summary.failed,
        total: summary.total,
    };
}, {
    audit: { action: 'BULK_UPDATE_RATES', entity: 'PROJECT_BOQ' },
    rawResponse: true
});