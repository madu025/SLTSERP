import { apiHandler } from '@/lib/api-handler';
import { AsBuiltService } from '@/services/as-built.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request, params) => {
    const { id: projectId } = params;
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
}, { rawResponse: true });