import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from "@/lib/api-handler";
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
    const userId = req.headers.get("x-user-id")!;
    const ipAddress = req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    return await HelpdeskService.createAssetUnit(userId, assetId, body, ipAddress, userAgent);
  },
  {
    schema: CreateITAssetUnitSchema,
    roles: ROLE_GROUPS.OFFICE_ADMINS,
    audit: {
      action: "CREATE",
      entity: "ITAssetUnit"
    }
  }
);

export const PUT = apiHandler(
  async (req, params, body) => {
    const userId = req.headers.get("x-user-id")!;
    const ipAddress = req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    return await HelpdeskService.updateAssetUnit(userId, body.unitId, body, ipAddress, userAgent);
  },
  {
    schema: UpdateITAssetUnitSchema,
    roles: ROLE_GROUPS.OFFICE_ADMINS,
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
      throw new Error("UNIT_ID_REQUIRED");
    }

    const userId = req.headers.get("x-user-id")!;
    const ipAddress = req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    return await HelpdeskService.deleteAssetUnit(userId, unitId, ipAddress, userAgent);
  },
  {
    roles: ROLE_GROUPS.OFFICE_ADMINS,
    audit: {
      action: "DELETE",
      entity: "ITAssetUnit"
    }
  }
);
