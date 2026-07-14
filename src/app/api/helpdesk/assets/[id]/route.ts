import { apiHandler } from "@/lib/api-handler";
import { HelpdeskService } from "@/services/helpdesk.service";
import { UpdateAssetSchema } from "@/lib/validations/helpdesk.schema";

export const GET = apiHandler(async (req, params) => {
  const { id } = await params;
  const asset = await HelpdeskService.getAssetById(id);
  if (!asset) {
    throw new Error("Asset not found");
  }
  return asset;
});

export const PUT = apiHandler(
  async (req, params, body) => {
    const { id } = await params;
    const userId = req.headers.get("x-user-id")!;
    const ipAddress = req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    return await HelpdeskService.updateAsset(userId, id, body, ipAddress, userAgent);
  },
  {
    schema: UpdateAssetSchema,
    roles: ["SUPER_ADMIN", "ADMIN", "OFFICE_ADMIN", "OFFICE_ADMIN_ASSISTANT"],
    audit: {
      action: "UPDATE",
      entity: "ITAsset"
    }
  }
);

export const DELETE = apiHandler(
  async (req, params) => {
    const { id } = await params;
    const userId = req.headers.get("x-user-id")!;
    const ipAddress = req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    return await HelpdeskService.deleteAsset(userId, id, ipAddress, userAgent);
  },
  {
    roles: ["SUPER_ADMIN", "ADMIN"],
    audit: {
      action: "DELETE",
      entity: "ITAsset"
    }
  }
);
