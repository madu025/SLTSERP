import { apiHandler } from "@/lib/api-handler";
import { SoftwareLicenseService } from "@/services/software-license.service";
import { CreateSoftwareLicenseAssignmentSchema } from "@/lib/validations/helpdesk.schema";

export const dynamic = 'force-dynamic';

export const POST = apiHandler(
  async (req, params, body) => {
    const { id: licenseId } = await params;
    const userId = req.headers.get("x-user-id")!;
    const ipAddress = req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    return await SoftwareLicenseService.assignLicense(userId, licenseId, body, ipAddress, userAgent);
  },
  {
    schema: CreateSoftwareLicenseAssignmentSchema,
    roles: ["SUPER_ADMIN", "ADMIN", "OFFICE_ADMIN", "ENGINEER"],
    audit: {
      action: "CREATE",
      entity: "SoftwareLicenseAssignment"
    }
  }
);

export const DELETE = apiHandler(
  async (req, _params) => {
    const url = new URL(req.url);
    const assignmentId = url.searchParams.get("assignmentId");
    if (!assignmentId) {
      throw new Error("ASSIGNMENT_ID_REQUIRED");
    }
    
    const userId = req.headers.get("x-user-id")!;
    const ipAddress = req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    return await SoftwareLicenseService.revokeLicense(userId, assignmentId, ipAddress, userAgent);
  },
  {
    roles: ["SUPER_ADMIN", "ADMIN", "OFFICE_ADMIN", "ENGINEER"],
    audit: {
      action: "DELETE",
      entity: "SoftwareLicenseAssignment"
    }
  }
);
