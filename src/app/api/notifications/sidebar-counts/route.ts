import { apiHandler } from "@/lib/api-handler";
import { NotificationService } from "@/services/notification/notification.service";
import { AppError } from "@/lib/error";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_req, params) => {
  // Fix #1: Completely eliminate IDOR risk by strictly using `apiHandler` injected metadata
  // instead of falling back to client-controllable searchParams or unvalidated headers.
  const userId = params._userId;
  let headerRole = params._userRole;

  if (!userId) {
    throw AppError.unauthorized("Unauthorized");
  }

  // Fix #3: Validate headerRole string matches strict Prisma Role enum.
  // If a forged or malformed header slips through, we safely drop it 
  // and force a secure fallback DB lookup instead of passing invalid types downstream.
  if (headerRole && !Object.values(Role).includes(headerRole as Role)) {
    console.warn(`[SidebarCounts] Invalid role string detected: ${headerRole}. Falling back to DB lookup.`);
    headerRole = null;
  }

  // If the auth middleware already forwarded a valid role, skip the extra DB lookup in getSidebarCounts
  if (headerRole) {
    // Still need assignedStoreId for stores staff — fetch just that field securely using the verified userId
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
