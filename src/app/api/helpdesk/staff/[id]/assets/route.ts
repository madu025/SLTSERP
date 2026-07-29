import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from "@/lib/api-handler";


import { HelpdeskService } from "@/services/helpdesk.service";

export const dynamic = 'force-dynamic';

export const GET = apiHandler(
  async (req, params) => {
    const { id } = await params;
    
    return await HelpdeskService.getStaffAssets(id);
  },
  {
    roles: ROLE_GROUPS.OFFICE_ADMINS
  }
);
