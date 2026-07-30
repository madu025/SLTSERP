import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from "@/lib/api-handler";
import { HelpdeskService } from "@/services/helpdesk/helpdesk.service";

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req) => {
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "1000");
  const search = url.searchParams.get("search") || "";

  return await HelpdeskService.getSiteOffices({
    page,
    limit,
    search
  });
}, {
  roles: ROLE_GROUPS.OFFICE_ADMINS
});
