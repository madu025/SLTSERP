import { apiHandler } from "@/lib/api-handler";


import { HelpdeskService } from "@/services/helpdesk.service";

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async () => {
  return await HelpdeskService.getAssetStats();
});
