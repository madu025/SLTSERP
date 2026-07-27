import { apiHandler } from "@/lib/api-handler";
import { InventoryService } from "@/services/inventory";

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async () => {
  return await InventoryService.getPublicSiteOffices();
});
