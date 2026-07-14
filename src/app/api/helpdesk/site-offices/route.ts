import { apiHandler } from "@/lib/api-handler";
import { HelpdeskService } from "@/services/helpdesk.service";
import { CreateSiteOfficeSchema } from "@/lib/validations/siteoffice.schema";

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req) => {
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const search = url.searchParams.get("search") || "";

  return await HelpdeskService.getSiteOffices({
    page,
    limit,
    search
  });
}, {
  roles: ["SUPER_ADMIN", "ADMIN", "ENGINEER", "OFFICE_ADMIN", "OFFICE_ADMIN_ASSISTANT"]
});

export const POST = apiHandler(
  async (req, _params, body) => {
    const userId = req.headers.get("x-user-id")!;
    const ipAddress = req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    return await HelpdeskService.createSiteOffice(userId, body, ipAddress, userAgent);
  },
  {
    schema: CreateSiteOfficeSchema,
    roles: ["SUPER_ADMIN", "ADMIN", "OFFICE_ADMIN"],
    audit: {
      action: "CREATE",
      entity: "SiteOffice" as any
    }
  }
);
