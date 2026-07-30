import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from "@/lib/api-handler";
import { HelpdeskService } from "@/services/helpdesk/helpdesk.service";

export const dynamic = 'force-dynamic';

export const GET = apiHandler(
  async () => {
    return await HelpdeskService.getDashboardReports();
  },
  {
    roles: ROLE_GROUPS.OFFICE_ADMINS
  }
);
