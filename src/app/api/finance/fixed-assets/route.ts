import { apiHandler } from '@/lib/api-handler';
import { FixedAssetService } from '@/services/finance/fixed-asset.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async () => {
    const register = await FixedAssetService.getAssetRegister();
    return register;
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'FINANCE_ASSISTANT']
});

export const POST = apiHandler(async (req) => {
    const body = await req.json();

    const asset = await FixedAssetService.createAsset({
        assetNumber: body.assetNumber,
        name: body.name,
        category: body.category,
        acquisitionDate: body.acquisitionDate ? new Date(body.acquisitionDate) : undefined,
        cost: Number(body.cost),
        usefulLifeYears: body.usefulLifeYears ? Number(body.usefulLifeYears) : undefined,
        depreciationMethod: body.depreciationMethod,
        glAssetCode: body.glAssetCode,
        glDepExpCode: body.glDepExpCode,
        glAccumDepCode: body.glAccumDepCode
    });

    return asset;
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER']
});
