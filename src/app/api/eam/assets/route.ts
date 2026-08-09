import { apiHandler, ApiHandlerMeta } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { OfficeAssetService } from '@/services/eam/office-asset.service';
import { ROLE_GROUPS } from '@/config/roles';
import { z } from 'zod';
import { OfficeAssetCategory } from '@prisma/client';

// Schema for creating an Office Asset
const createOfficeAssetSchema = z.object({
  assetNumber: z.string().min(1, "Asset number is required"),
  serialNumber: z.string().optional(),
  name: z.string().min(2, "Asset name is required"),
  category: z.nativeEnum(OfficeAssetCategory),
  siteOfficeId: z.string().optional(),
  locationDetails: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  purchaseCost: z.number().optional(),
  purchaseDate: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  warrantyExpiry: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const dynamic = 'force-dynamic';

export const GET = apiHandler(
  async () => {
    const assets = await OfficeAssetService.getAllAssets();
    return assets;
  },
  {
    roles: ROLE_GROUPS.EAM_ASSET_MANAGERS,
    audit: { action: 'READ_EAM_ASSETS', entity: 'OfficeAsset' }
  }
);

export const POST = apiHandler(
  async (_request, params, body) => {
    const validatedData = createOfficeAssetSchema.parse(body);
    const userId = (params as unknown as ApiHandlerMeta)._userId;
    
    if (!userId) {
        throw AppError.unauthorized("Unauthorized");
    }

    const asset = await OfficeAssetService.createAsset(validatedData, userId);
    return asset;
  },
  {
    roles: ROLE_GROUPS.EAM_ASSET_MANAGERS,
    audit: { action: 'CREATE_EAM_ASSET', entity: 'OfficeAsset' }
  }
);
