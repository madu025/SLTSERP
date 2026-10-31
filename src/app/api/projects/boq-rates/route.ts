import { apiHandler } from '@/lib/api-handler';
import { ProjectBOQService } from '@/services/project/project-boq.service';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { assertProjectAccess } from '@/lib/project-access';
import { getAccessibleProjectIds } from '@/lib/project-record-access';
import { z } from 'zod';

const saveRateSchema = z.object({
    itemCode: z.string().min(1), unitRate: z.union([z.string(), z.number()]),
    description: z.string().optional(), unit: z.string().optional(),
    itemCategory: z.string().optional(), projectId: z.string().nullish(), isActive: z.boolean().optional(),
});

export const dynamic = 'force-dynamic';

// Rate master data: changing a rate alters costing, so it is an approval-grade finance capability.
const RATE_WRITE_PERMISSIONS = [RBAC_PERMISSIONS.PROJECT_FINANCE_APPROVE, RBAC_PERMISSIONS.FINANCE_APPROVE];

export const GET = apiHandler(async (request, params) => {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const isActive = searchParams.get('isActive');

    const isActiveVal = isActive !== null && isActive !== undefined ? isActive === 'true' : undefined;

    let rates;
    if (projectId) {
        await assertProjectAccess(projectId, params._userId);
        rates = await ProjectBOQService.getBOQRates(projectId, isActiveVal);
    } else {
        // No project filter: return global rates plus rates of projects inside the caller's OPMC scope.
        const accessible = await getAccessibleProjectIds(params._userId);
        const all = await ProjectBOQService.getBOQRates(null, isActiveVal);
        rates = accessible === undefined
            ? all
            : all.filter((r) => r.projectId === null || accessible.has(r.projectId));
    }

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
}, { permissions: [RBAC_PERMISSIONS.PROJECT_FINANCE_READ], rawResponse: true });

export const POST = apiHandler(async (_request, params, body) => {
    const { itemCode, unitRate, projectId } = body || {};

    if (!itemCode || unitRate === undefined) {
        throw AppError.badRequest('itemCode and unitRate are required');
    }

    if (projectId) await assertProjectAccess(projectId as string, params._userId);

    const { rate, isNew } = await ProjectBOQService.saveBOQRate(saveRateSchema.parse(body));
    return Response.json(rate, { status: isNew ? 201 : 200 });
}, {
    permissions: RATE_WRITE_PERMISSIONS,
    audit: { action: 'UPSERT_RATE', entity: 'PROJECT_BOQ' },
    rawResponse: true
});

export const PATCH = apiHandler(async (_request, params, body) => {
    const { rates } = body || {};

    if (!rates || !Array.isArray(rates) || rates.length === 0) {
        throw AppError.badRequest('rates array is required');
    }

    const projectIds = new Set<string>();
    for (const r of rates as Array<{ projectId?: string | null }>) {
        if (r && r.projectId) projectIds.add(r.projectId);
    }
    for (const pid of projectIds) await assertProjectAccess(pid, params._userId);

    const summary = await ProjectBOQService.bulkUpdateBOQRates(rates);

    return {
        message: `Bulk rate update: ${summary.succeeded} succeeded, ${summary.failed} failed`,
        succeeded: summary.succeeded,
        failed: summary.failed,
        total: summary.total,
    };
}, {
    permissions: RATE_WRITE_PERMISSIONS,
    audit: { action: 'BULK_UPDATE_RATES', entity: 'PROJECT_BOQ' },
    rawResponse: true
});
