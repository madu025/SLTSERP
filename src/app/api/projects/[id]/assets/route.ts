import { apiHandler } from '@/lib/api-handler';
import { ProjectAssetService } from '@/services/project/project-asset.service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const { id: projectId } = params;
    return await ProjectAssetService.getAssets(projectId);
}, { rawResponse: true });

const createAssetSchema = z.object({
    assetType: z.string().min(1),
    assetCode: z.string().optional().nullable(),
    assetName: z.string().min(1),
    description: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    latitude: z.number().optional().nullable(),
    longitude: z.number().optional().nullable(),
    status: z.string().optional().nullable(),
});

export const POST = apiHandler(async (request, params, body) => {
    const { id: projectId } = params;
    const data = createAssetSchema.parse(body);

    const userId = request.headers.get('x-user-id') || 'system';

    const asset = await ProjectAssetService.createAsset(projectId, {
        assetType: data.assetType,
        assetCode: data.assetCode || undefined,
        assetName: data.assetName,
        description: data.description || undefined,
        address: data.address || undefined,
        latitude: data.latitude || undefined,
        longitude: data.longitude || undefined,
        status: data.status || undefined,
        createdById: userId
    });

    return Response.json(asset, { status: 201 });
}, {
    audit: { action: 'CREATE', entity: 'PROJECT_ASSET' },
    rawResponse: true
});