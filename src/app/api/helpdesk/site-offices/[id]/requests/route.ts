import { apiHandler } from "@/lib/api-handler";
import { HelpdeskService } from "@/services/helpdesk.service";
import { CreateOfficeRequestSchema, UpdateOfficeRequestSchema } from "@/lib/validations/siteoffice.schema";

export const POST = apiHandler(
  async (req, params, body) => {
    const { id: siteOfficeId } = await params;
    const userId = req.headers.get("x-user-id")!;
    const ipAddress = req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    return await HelpdeskService.createOfficeRequest(userId, siteOfficeId, userId, body, ipAddress, userAgent);
  },
  {
    schema: CreateOfficeRequestSchema,
    roles: ["SUPER_ADMIN", "ADMIN", "OFFICE_ADMIN", "OFFICE_ADMIN_ASSISTANT", "ENGINEER"],
    audit: {
      action: "CREATE",
      entity: "SiteOfficeRequest" as any
    }
  }
);

export const PUT = apiHandler(
  async (req, params, body) => {
    const userId = req.headers.get("x-user-id")!;
    const url = new URL(req.url);
    const requestId = url.searchParams.get("requestId");
    if (!requestId) throw new Error("Request ID is required");

    const ipAddress = req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    return await HelpdeskService.updateOfficeRequest(userId, requestId, body, ipAddress, userAgent);
  },
  {
    schema: UpdateOfficeRequestSchema,
    roles: ["SUPER_ADMIN", "ADMIN", "OFFICE_ADMIN"],
    audit: {
      action: "UPDATE",
      entity: "SiteOfficeRequest" as any
    }
  }
);

export const DELETE = apiHandler(
  async (req) => {
    const userId = req.headers.get("x-user-id")!;
    const url = new URL(req.url);
    const requestId = url.searchParams.get("requestId");
    if (!requestId) throw new Error("Request ID is required");

    const ipAddress = req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    return await HelpdeskService.deleteOfficeRequest(userId, requestId, ipAddress, userAgent);
  },
  {
    roles: ["SUPER_ADMIN", "ADMIN", "OFFICE_ADMIN"],
    audit: {
      action: "DELETE",
      entity: "SiteOfficeRequest" as any
    }
  }
);
