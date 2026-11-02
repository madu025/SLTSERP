import { apiHandler } from "@/lib/api-handler";
import { HelpdeskService } from "@/services/helpdesk/helpdesk.service";

export const dynamic = 'force-dynamic';

export const GET = apiHandler(
  async (req, params) => {
    const { id } = await params;

    const timeline = await HelpdeskService.getAssetHistory(id);

    return timeline;
  },
  {
  }
);
