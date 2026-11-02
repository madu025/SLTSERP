import { getAuthenticatedUserId } from '@/lib/request-context';
import { apiHandler } from "@/lib/api-handler";
import { AppError } from "@/lib/error";
import { SoftwareLicenseService } from "@/services/core/software-license.service";
import { CreateSoftwareLicenseAssignmentSchema } from "@/lib/validations/helpdesk.schema";

export const dynamic = 'force-dynamic';

export const POST = apiHandler(
  async (req, params, body) => {
    const { id: licenseId } = await params;
    const userId = getAuthenticatedUserId()!;
    const ipAddress = req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    return await SoftwareLicenseService.assignLicense(userId, licenseId, body, ipAddress, userAgent);
  },
  {
    schema: CreateSoftwareLicenseAssignmentSchema,
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
      throw AppError.badRequest("ASSIGNMENT_ID_REQUIRED");
    }
    
    const userId = getAuthenticatedUserId()!;
    const ipAddress = req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    return await SoftwareLicenseService.revokeLicense(userId, assignmentId, ipAddress, userAgent);
  },
  {
    audit: {
      action: "DELETE",
      entity: "SoftwareLicenseAssignment"
    }
  }
);
