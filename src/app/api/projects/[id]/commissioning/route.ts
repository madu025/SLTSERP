import { apiHandler } from '@/lib/api-handler';
import { ProjectCommissioningService } from '@/services/project/project-commissioning.service';
import { z } from 'zod';
import { AppError } from '@/lib/error';

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
}).strict();

export const POST = apiHandler(async (_request, params, body) => {
    const { id: projectId } = params;
    const data = commissionAssetSchema.parse(body);
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    const result = await ProjectCommissioningService.commissionAsset(projectId, data, params._userId);
    return Response.json(result, { status: 201 });
}, {
    audit: { action: 'CREATE', entity: 'ASSET_COMMISSIONING' },
    rawResponse: true
});
