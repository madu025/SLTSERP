import { apiHandler } from '@/lib/api-handler';
import { ProjectCommissioningService } from '@/services/project/project-commissioning.service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const { id: projectId } = params;
    return await ProjectCommissioningService.getCommissionedAssets(projectId);
}, { rawResponse: true });

const commissionAssetSchema = z.object({
    name: z.string().min(1),
    serialNumber: z.string().min(1),
    warrantyMonths: z.number().optional(),
    status: z.string().optional(),
    assetType: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    createdById: z.string().optional(),
});

export const POST = apiHandler(async (_request, params, body) => {
    const { id: projectId } = params;
    const data = commissionAssetSchema.parse(body);
    const result = await ProjectCommissioningService.commissionAsset(projectId, data);
    return Response.json(result, { status: 201 });
}, {
    audit: { action: 'CREATE', entity: 'ASSET_COMMISSIONING' },
    rawResponse: true
});