import { apiHandler } from '@/lib/api-handler';
import { AsBuiltService } from '@/services/project/as-built.service';
import { AppError } from '@/lib/error';
import { assertProjectAccess } from '@/lib/project-access';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request, params) => {
    const { id: projectId } = params;
    await assertProjectAccess(projectId, params._userId);
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'qgis';
    const layerId = searchParams.get('layerId');

    switch (format) {
        case 'qgis':
            return await AsBuiltService.generateQGIS(projectId);

        case 'layer':
            if (!layerId) throw AppError.badRequest('layerId required for layer export');
            return await AsBuiltService.exportLayerGeoJSON(projectId, layerId);

        case 'cad':
            return await AsBuiltService.exportCAD(projectId);

        case 'comparison':
            return await AsBuiltService.getAsBuiltComparison(projectId);

        default:
            throw AppError.badRequest('Invalid format. Use: qgis, layer, cad, comparison');
    }
}, { permissions: [RBAC_PERMISSIONS.PROJECT_READ], rawResponse: true });
