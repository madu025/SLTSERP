import { apiHandler } from "@/lib/api-handler";
import { NotificationService } from "@/services/notification/notification.service";
import { AppError } from "@/lib/error";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const userId = req.headers.get("x-user-id") || searchParams.get("userId");
  const headerRole = req.headers.get("x-user-role");

  if (!userId) {
    throw AppError.unauthorized("Unauthorized");
  }

  // If the auth middleware already forwarded the role, skip the extra DB lookup in getSidebarCounts
  if (headerRole) {
    // Still need assignedStoreId for stores staff — fetch just that field
    const needsStoreId = ['STORES_MANAGER', 'STORES_ASSISTANT'].includes(headerRole);
    let assignedStoreId: string | null = null;
    if (needsStoreId) {
      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { assignedStoreId: true }
      });
      assignedStoreId = dbUser?.assignedStoreId ?? null;
    }
    return await NotificationService.getSidebarCounts(userId, headerRole, assignedStoreId);
  }

  return await NotificationService.getSidebarCounts(userId);
});
