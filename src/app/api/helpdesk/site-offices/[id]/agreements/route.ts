import { apiHandler } from "@/lib/api-handler";
import { HelpdeskService } from "@/services/helpdesk.service";
import { CreateAgreementSchema, UpdateAgreementSchema } from "@/lib/validations/siteoffice.schema";

export const POST = apiHandler(
  async (req, params, body) => {
    const { id: siteOfficeId } = await params;
    const userId = req.headers.get("x-user-id")!;
    const ipAddress = req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    return await HelpdeskService.createAgreement(userId, siteOfficeId, body, ipAddress, userAgent);
  },
  {
    schema: CreateAgreementSchema,
    roles: ["SUPER_ADMIN", "ADMIN", "OFFICE_ADMIN"],
    audit: {
      action: "CREATE",
      entity: "SiteOfficeAgreement" as any
    }
  }
);

export const PUT = apiHandler(
  async (req, params, body) => {
    const userId = req.headers.get("x-user-id")!;
    const url = new URL(req.url);
    const agreementId = url.searchParams.get("agreementId");
    if (!agreementId) throw new Error("Agreement ID is required");

    const ipAddress = req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    return await HelpdeskService.updateAgreement(userId, agreementId, body, ipAddress, userAgent);
  },
  {
    schema: UpdateAgreementSchema,
    roles: ["SUPER_ADMIN", "ADMIN", "OFFICE_ADMIN"],
    audit: {
      action: "UPDATE",
      entity: "SiteOfficeAgreement" as any
    }
  }
);

export const DELETE = apiHandler(
  async (req) => {
    const userId = req.headers.get("x-user-id")!;
    const url = new URL(req.url);
    const agreementId = url.searchParams.get("agreementId");
    if (!agreementId) throw new Error("Agreement ID is required");

    const ipAddress = req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    return await HelpdeskService.deleteAgreement(userId, agreementId, ipAddress, userAgent);
  },
  {
    roles: ["SUPER_ADMIN", "ADMIN", "OFFICE_ADMIN"],
    audit: {
      action: "DELETE",
      entity: "SiteOfficeAgreement" as any
    }
  }
);
