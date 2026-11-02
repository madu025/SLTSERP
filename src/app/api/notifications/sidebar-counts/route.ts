import { apiHandler } from "@/lib/api-handler";
import { NotificationService } from "@/services/notification/notification.service";
import { AppError } from "@/lib/error";

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_req, params) => {
  const userId = params._userId;

  if (!userId) {
    throw AppError.unauthorized("Unauthorized");
  }

  return await NotificationService.getSidebarCounts(userId);
});
