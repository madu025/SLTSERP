import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from "@/lib/api-handler";
import { HelpdeskAuditService } from "@/services/helpdesk-audit.service";

export const dynamic = 'force-dynamic';

// GET: Fetch Audit Gaps (Missing, Unregistered, Mismatched)
export const GET = apiHandler(
  async () => {
    return await HelpdeskAuditService.getAuditGaps();
  },
  {
    roles: [...ROLE_GROUPS.OFFICE_ADMINS, "ENGINEER", "OFFICE_ADMIN_ASSISTANT"]
  }
);
