import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from "@/lib/api-handler";
import { SoftwareLicenseService } from "@/services/core/software-license.service";
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
    roles: ROLE_GROUPS.OFFICE_ADMINS,
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
    roles: ROLE_GROUPS.OFFICE_ADMINS,
    audit: {
      action: "DELETE",
      entity: "SoftwareLicenseAssignment"
    }
  }
);
