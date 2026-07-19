import { apiHandler } from "@/lib/api-handler";
import { HelpdeskAuditService } from "@/services/helpdesk-audit.service";

export const dynamic = 'force-dynamic';

// GET: Fetch Audit Gaps (Missing, Unregistered, Mismatched)
export const GET = apiHandler(
  async () => {
    return await HelpdeskAuditService.getAuditGaps();
  },
  {
    roles: ["SUPER_ADMIN", "ADMIN", "ENGINEER", "OFFICE_ADMIN", "OFFICE_ADMIN_ASSISTANT"]
  }
);
