import { apiHandler } from '@/lib/api-handler';
import { ProjectAssetService } from '@/services/project/project-asset.service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const { assetId } = params;
    return await ProjectAssetService.getAsset(assetId);
}, { rawResponse: true });

const patchAssetSchema = z.object({
    assetType: z.string().optional(),
    assetCode: z.string().optional(),
    assetName: z.string().optional(),
    description: z.string().optional(),
    address: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    status: z.string().optional(),
});

export const PATCH = apiHandler(async (_request, params, body) => {
    const { assetId } = params;
    const data = patchAssetSchema.parse(body);
    return await ProjectAssetService.updateAsset(assetId, data);
}, {
    audit: { action: 'UPDATE', entity: 'ASSET' },
    rawResponse: true
});

export const DELETE = apiHandler(async (_request, params) => {
    const { assetId } = params;
    return await ProjectAssetService.deleteAsset(assetId);
}, {
    audit: { action: 'DELETE', entity: 'ASSET' },
    rawResponse: true
});