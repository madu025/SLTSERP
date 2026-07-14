import { apiHandler } from "@/lib/api-handler";
import { HelpdeskService } from "@/services/helpdesk.service";
import { UpdateSiteOfficeSchema } from "@/lib/validations/siteoffice.schema";

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req, params) => {
  const { id } = await params;
  const siteOffice = await HelpdeskService.getSiteOffice(id);
  if (!siteOffice) {
    throw new Error("Site office not found");
  }
  return siteOffice;
}, {
  roles: ["SUPER_ADMIN", "ADMIN", "ENGINEER", "OFFICE_ADMIN", "OFFICE_ADMIN_ASSISTANT"]
});

export const PUT = apiHandler(
  async (req, params, body) => {
    const { id } = await params;
    const userId = req.headers.get("x-user-id")!;
    const ipAddress = req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    return await HelpdeskService.updateSiteOffice(userId, id, body, ipAddress, userAgent);
  },
  {
    schema: UpdateSiteOfficeSchema,
    roles: ["SUPER_ADMIN", "ADMIN", "OFFICE_ADMIN"],
    audit: {
      action: "UPDATE",
      entity: "SiteOffice" as any
    }
  }
);

export const DELETE = apiHandler(
  async (req, params) => {
    const { id } = await params;
    const userId = req.headers.get("x-user-id")!;
    const ipAddress = req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    return await HelpdeskService.deleteSiteOffice(userId, id, ipAddress, userAgent);
  },
  {
    roles: ["SUPER_ADMIN", "ADMIN"],
    audit: {
      action: "DELETE",
      entity: "SiteOffice" as any
    }
  }
);
