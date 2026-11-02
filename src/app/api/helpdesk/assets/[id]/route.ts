import { getAuthenticatedUserId } from '@/lib/request-context';
export const dynamic = 'force-dynamic';

import { apiHandler } from "@/lib/api-handler";
import { AppError } from "@/lib/error";
import { HelpdeskService } from "@/services/helpdesk/helpdesk.service";
import { UpdateAssetSchema } from "@/lib/validations/helpdesk.schema";

export const GET = apiHandler(async (req, params) => {
  const { id } = await params;
  const asset = await HelpdeskService.getAssetById(id);
  if (!asset) {
    throw AppError.notFound("Asset not found");
  }
  return asset;
});

export const PUT = apiHandler(
  async (req, params, body) => {
    const { id } = await params;
    const userId = getAuthenticatedUserId()!;
    const ipAddress = req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    return await HelpdeskService.updateAsset(userId, id, body, ipAddress, userAgent);
  },
  {
    schema: UpdateAssetSchema,
    audit: {
      action: "UPDATE",
      entity: "ITAsset"
    }
  }
);

export const DELETE = apiHandler(
  async (req, params) => {
    const { id } = await params;
    const userId = getAuthenticatedUserId()!;
    const ipAddress = req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    return await HelpdeskService.deleteAsset(userId, id, ipAddress, userAgent);
  },
  {
    audit: {
      action: "DELETE",
      entity: "ITAsset"
    }
  }
);
