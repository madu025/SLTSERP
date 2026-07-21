import { apiHandler } from "@/lib/api-handler";
import { NotificationService } from "@/services/notification.service";
import { AppError } from "@/lib/error";

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req) => {
  const userId = req.headers.get("x-user-id");

  if (!userId) {
    throw AppError.unauthorized("Unauthorized");
  }

  return await NotificationService.getSidebarCounts(userId);
});
