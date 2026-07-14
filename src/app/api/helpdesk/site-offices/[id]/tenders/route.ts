import { apiHandler } from "@/lib/api-handler";
import { HelpdeskService } from "@/services/helpdesk.service";
import { CreateOfficeTenderSchema, UpdateOfficeTenderSchema } from "@/lib/validations/siteoffice.schema";

export const POST = apiHandler(
  async (req, params, body) => {
    const { id: siteOfficeId } = await params;
    const userId = req.headers.get("x-user-id")!;
    const ipAddress = req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    return await HelpdeskService.createOfficeTender(userId, siteOfficeId, body, ipAddress, userAgent);
  },
  {
    schema: CreateOfficeTenderSchema,
    roles: ["SUPER_ADMIN", "ADMIN", "OFFICE_ADMIN"],
    audit: {
      action: "CREATE",
      entity: "SiteOfficeTender" as any
    }
  }
);

export const PUT = apiHandler(
  async (req, params, body) => {
    const userId = req.headers.get("x-user-id")!;
    const url = new URL(req.url);
    const tenderId = url.searchParams.get("tenderId");
    if (!tenderId) throw new Error("Tender ID is required");

    const ipAddress = req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    return await HelpdeskService.updateOfficeTender(userId, tenderId, body, ipAddress, userAgent);
  },
  {
    schema: UpdateOfficeTenderSchema,
    roles: ["SUPER_ADMIN", "ADMIN", "OFFICE_ADMIN"],
    audit: {
      action: "UPDATE",
      entity: "SiteOfficeTender" as any
    }
  }
);

export const DELETE = apiHandler(
  async (req) => {
    const userId = req.headers.get("x-user-id")!;
    const url = new URL(req.url);
    const tenderId = url.searchParams.get("tenderId");
    if (!tenderId) throw new Error("Tender ID is required");

    const ipAddress = req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    return await HelpdeskService.deleteOfficeTender(userId, tenderId, ipAddress, userAgent);
  },
  {
    roles: ["SUPER_ADMIN", "ADMIN", "OFFICE_ADMIN"],
    audit: {
      action: "DELETE",
      entity: "SiteOfficeTender" as any
    }
  }
);
