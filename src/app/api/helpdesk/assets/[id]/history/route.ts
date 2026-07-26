import { apiHandler } from "@/lib/api-handler";
import { HelpdeskService } from "@/services/helpdesk.service";

export const dynamic = 'force-dynamic';

export const GET = apiHandler(
  async (req, params) => {
    const { id } = await params;

    const timeline = await HelpdeskService.getAssetHistory(id);

    return timeline;
  },
  {
    roles: ["SUPER_ADMIN", "ADMIN", "ENGINEER", "STORE_KEEPER", "OFFICE_ADMIN", "OFFICE_ADMIN_ASSISTANT"]
  }
);
