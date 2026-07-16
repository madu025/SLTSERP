import { apiHandler } from "@/lib/api-handler";
import { SoftwareLicenseService } from "@/services/software-license.service";
import { UpdateSoftwareLicenseSchema } from "@/lib/validations/helpdesk.schema";

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_req, params) => {
  const { id } = await params;
  return await SoftwareLicenseService.getLicenseById(id);
});

export const PUT = apiHandler(
  async (req, params, body) => {
    const { id } = await params;
    const userId = req.headers.get("x-user-id")!;
    const ipAddress = req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    return await SoftwareLicenseService.updateLicense(userId, id, body, ipAddress, userAgent);
  },
  {
    schema: UpdateSoftwareLicenseSchema,
    roles: ["SUPER_ADMIN", "ADMIN", "OFFICE_ADMIN", "ENGINEER"],
    audit: {
      action: "UPDATE",
      entity: "SoftwareLicense"
    }
  }
);

export const DELETE = apiHandler(
  async (req, params) => {
    const { id } = await params;
    const userId = req.headers.get("x-user-id")!;
    const ipAddress = req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    return await SoftwareLicenseService.deleteLicense(userId, id, ipAddress, userAgent);
  },
  {
    roles: ["SUPER_ADMIN", "ADMIN"],
    audit: {
      action: "DELETE",
      entity: "SoftwareLicense"
    }
  }
);
