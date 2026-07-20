import { apiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';



export const GET = apiHandler(async (req) => {
  const userId = req.headers.get("x-user-id");

  if (!userId) {
    throw new Error("Unauthorized");
  }


  // Instead of firing 7 parallel COUNT queries which DDoSes the DB on global SSE events,
  // we fetch all unread notifications (since it's capped at 50 per user by NotificationService)
  // and aggregate the counts in memory.
  const unreadNotifications = await prisma.notification.findMany({
    where: {
      userId,
      isRead: false
    },
    select: {
      link: true,
      metadata: true
    },
    take: 100 // Hard cap to prevent memory leaks if limits fail
  });

  let approvalsCount = 0;
  let helpdeskCount = 0;
  let serviceOrdersCount = 0;
  let procurementApprovalsCount = 0;
  let contractorApprovalsCount = 0;
  let materialRequestsCount = 0;
  let materialApprovalsCount = 0;

  for (const n of unreadNotifications) {
    const link = n.link || "";

    if (link.startsWith("/projects")) approvalsCount++;
    else if (link.startsWith("/helpdesk")) helpdeskCount++;
    else if (link.startsWith("/admin/inventory")) procurementApprovalsCount++;
    else if (link.startsWith("/admin/contractors")) contractorApprovalsCount++;
    else if (link.startsWith("/inventory/requests")) materialRequestsCount++;
    else if (link.startsWith("/inventory/approvals")) materialApprovalsCount++;
    else if (link.startsWith("/service-orders")) {
      // Service Orders uses metadata.count for batched sync notifications
      if (n.metadata && typeof n.metadata === 'object' && !Array.isArray(n.metadata)) {
        const meta = n.metadata as Record<string, unknown>;
        serviceOrdersCount += typeof meta.count === 'number' ? meta.count : 1;
      } else {
        serviceOrdersCount += 1;
      }
    }
  }

  return {
    approvals: approvalsCount,
    helpdesk: helpdeskCount,
    serviceOrders: serviceOrdersCount,
    procurementApprovals: procurementApprovalsCount,
    contractorApprovals: contractorApprovalsCount,
    materialRequests: materialRequestsCount,
    materialApprovals: materialApprovalsCount
  };
});
