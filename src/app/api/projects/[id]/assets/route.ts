import { apiHandler } from '@/lib/api-handler';
import { ProjectAssetService } from '@/services/project/project-asset.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const { id: projectId } = params;
    return await ProjectAssetService.getAssets(projectId);
}, { rawResponse: true });

export const POST = apiHandler(async (request, params, body) => {
    const { id: projectId } = params;
    const { assetType, assetName } = body || {};

    if (!assetType || !assetName) {
        throw AppError.badRequest('Missing required fields: assetType, assetName');
    }

    const userId = request.headers.get('x-user-id') || 'system';

    const asset = await ProjectAssetService.createAsset(projectId, {
        ...(body as unknown as Parameters<typeof ProjectAssetService.createAsset>[1]),
        createdById: userId
    });

    return Response.json(asset, { status: 201 });
}, {
    audit: { action: 'CREATE', entity: 'PROJECT_ASSET' },
    rawResponse: true
});