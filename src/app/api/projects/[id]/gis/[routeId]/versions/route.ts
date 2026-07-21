import { apiHandler } from '@/lib/api-handler';
import { RouteVersionService } from '@/services/route-version.service';
import { z } from 'zod';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const { routeId } = params;
    return await RouteVersionService.getVersionHistory(routeId);
}, { rawResponse: true });

const versionSchema = z.object({
    action: z.enum(['new_version', 'rollback']).optional(),
    versionType: z.enum(['PLANNED', 'FIELD_CHANGE', 'BEFORE_PAT', 'AS_BUILT']).optional(),
    changeRequestId: z.string().optional(),
    geojsonData: z.record(z.string(), z.unknown()).optional(),
});

export const POST = apiHandler(async (_request, params, body) => {
    const { id: projectId, routeId } = params;
    const data = versionSchema.parse(body);
    const action = data.action || 'new_version';

    if (action === 'new_version') {
        if (!data.versionType) {
            throw AppError.badRequest('versionType is required (PLANNED, FIELD_CHANGE, BEFORE_PAT, AS_BUILT)');
        }

        const result = await RouteVersionService.createNewVersion({
            projectId,
            routeId,
            versionType: data.versionType,
            changeRequestId: data.changeRequestId || undefined,
            geojsonData: data.geojsonData || undefined,
        });

        return Response.json({ message: `New version created: v${result.current.version}`, ...result }, { status: 201 });
    }

    if (action === 'rollback') {
        const result = await RouteVersionService.rollback(routeId);
        return Response.json(result);
    }
}, {
    audit: { action: 'UPDATE', entity: 'ROUTE_VERSION' },
    rawResponse: true
});