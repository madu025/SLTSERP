import { apiHandler } from "@/lib/api-handler";
import { NotificationService } from "@/services/notification/notification.service";
import { AppError } from "@/lib/error";
import { ProjectNextActionService } from "@/services/project/project-next-action.service";

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_req, params) => {
  const userId = params._userId;

  if (!userId) {
    throw AppError.unauthorized("Unauthorized");
  }

  const [counts, myTasks] = await Promise.all([
    NotificationService.getSidebarCounts(userId),
    // What-to-do-next items waiting on this user; best effort so a failure never hides the other badges.
    ProjectNextActionService.countForUser(userId).catch(() => 0),
  ]);
  return { ...counts, myTasks };
});
