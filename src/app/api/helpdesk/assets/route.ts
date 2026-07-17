import { apiHandler } from "@/lib/api-handler";
import { HelpdeskService } from "@/services/helpdesk.service";
import { CreateAssetSchema } from "@/lib/validations/helpdesk.schema";
import { ITDeviceType, ITAssetStatus } from "@prisma/client";

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req) => {
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "20");
  const search = url.searchParams.get("search") || "";
  const status = url.searchParams.get("status") as ITAssetStatus || undefined;
  const deviceType = url.searchParams.get("deviceType") as ITDeviceType || undefined;
  const assignedStaffId = url.searchParams.get("assignedStaffId") || undefined;

  return await HelpdeskService.getAssets({
    page,
    limit,
    search,
    status,
    deviceType,
    assignedStaffId
  });
});

export const POST = apiHandler(
  async (req, _params, body) => {
    const userId = req.headers.get("x-user-id")!;
    const ipAddress = req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    return await HelpdeskService.createAsset(userId, body, ipAddress, userAgent);
  },
  {
    schema: CreateAssetSchema,
    roles: ["SUPER_ADMIN", "ADMIN", "ENGINEER", "OFFICE_ADMIN", "OFFICE_ADMIN_ASSISTANT"],
    audit: {
      action: "CREATE",
      entity: "ITAsset"
    }
  }
);
