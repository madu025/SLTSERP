import { apiHandler } from "@/lib/api-handler";
import { SoftwareLicenseService } from "@/services/software-license.service";
import { CreateSoftwareLicenseSchema } from "@/lib/validations/helpdesk.schema";

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req) => {
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "20");
  const search = url.searchParams.get("search") || "";
  const status = url.searchParams.get("status") || undefined;

  return await SoftwareLicenseService.getLicenses({
    page,
    limit,
    search,
    status
  });
});

export const POST = apiHandler(
  async (req, _params, body) => {
    const userId = req.headers.get("x-user-id")!;
    const ipAddress = req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    return await SoftwareLicenseService.createLicense(userId, body, ipAddress, userAgent);
  },
  {
    schema: CreateSoftwareLicenseSchema,
    roles: ["SUPER_ADMIN", "ADMIN", "OFFICE_ADMIN", "ENGINEER"],
    audit: {
      action: "CREATE",
      entity: "SoftwareLicense"
    }
  }
);
