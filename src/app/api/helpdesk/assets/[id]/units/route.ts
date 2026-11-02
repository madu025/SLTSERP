import { getAuthenticatedUserId } from '@/lib/request-context';
import { apiHandler } from "@/lib/api-handler";
import { AppError } from "@/lib/error";
import { HelpdeskService } from "@/services/helpdesk/helpdesk.service";
import { CreateITAssetUnitSchema, UpdateITAssetUnitSchema } from "@/lib/validations/helpdesk.schema";


export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req, params) => {
  const { id: assetId } = await params;

  const units = await HelpdeskService.getAssetUnits(assetId);

  return { success: true, data: units };
});

export const POST = apiHandler(
  async (req, params, body) => {
    const { id: assetId } = await params;
    const userId = getAuthenticatedUserId()!;
    const ipAddress = req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    return await HelpdeskService.createAssetUnit(userId, assetId, body, ipAddress, userAgent);
  },
  {
    schema: CreateITAssetUnitSchema,
    audit: {
      action: "CREATE",
      entity: "ITAssetUnit"
    }
  }
);

export const PUT = apiHandler(
  async (req, params, body) => {
    const userId = getAuthenticatedUserId()!;
    const ipAddress = req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    return await HelpdeskService.updateAssetUnit(userId, body.unitId, body, ipAddress, userAgent);
  },
  {
    schema: UpdateITAssetUnitSchema,
    audit: {
      action: "UPDATE",
      entity: "ITAssetUnit"
    }
  }
);

export const DELETE = apiHandler(
  async (req, _params) => {
    const url = new URL(req.url);
    const unitId = url.searchParams.get("unitId");
    if (!unitId) {
      throw AppError.badRequest("UNIT_ID_REQUIRED");
    }

    const userId = getAuthenticatedUserId()!;
    const ipAddress = req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    return await HelpdeskService.deleteAssetUnit(userId, unitId, ipAddress, userAgent);
  },
  {
    audit: {
      action: "DELETE",
      entity: "ITAssetUnit"
    }
  }
);
