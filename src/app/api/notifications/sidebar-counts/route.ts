import { apiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

function getWorkflowStageFilter(userRole: string) {
  switch (userRole) {
    case 'AREA_MANAGER':
      return 'ARM_APPROVAL';
    case 'STORES_MANAGER':
      return 'STORES_MANAGER_APPROVAL';
    case 'OSP_MANAGER':
      return 'OSP_MANAGER_APPROVAL';
    case 'STORES_ASSISTANT':
      return 'MAIN_STORE_RELEASE';
    case 'SUB_STORE_RECEIVE':
      return 'SUB_STORE_RECEIVE';
    default:
      return 'SUB_STORE_RECEIVE';
  }
}

export const GET = apiHandler(async (req) => {
  const userId = req.headers.get("x-user-id");
  const userRole = req.headers.get("x-user-role") || "ENGINEER";

  if (!userId) {
    throw new Error("Unauthorized");
  }

  const isITStaff = ["SUPER_ADMIN", "ADMIN", "ENGINEER", "OFFICE_ADMIN", "OFFICE_ADMIN_ASSISTANT"].includes(userRole);
  const stage = getWorkflowStageFilter(userRole);

  // Run all independent count and select queries concurrently to minimize DB latency
  const [
    approvalsCount,
    helpdeskCount,
    user,
    unreadSodNotifications,
    procurementApprovalsCount,
    contractorApprovalsCount,
    materialRequestsCount,
    materialApprovalsCount
  ] = await Promise.all([
    // 1. Project/Workflow approvals (Unread Notifications)
    prisma.notification.count({
      where: {
        userId,
        link: { startsWith: "/projects" },
        isRead: false
      }
    }),

    // 2. IT Help Desk (Unread Notifications)
    prisma.notification.count({
      where: {
        userId,
        link: {
          startsWith: "/helpdesk"
        },
        isRead: false
      }
    }),

    // 3. User Accessible OPMCs
    prisma.user.findUnique({
      where: { id: userId },
      include: {
        accessibleOpmcs: {
          select: { id: true }
        }
      }
    }),

    // 4. Service Orders notifications (startsWith to catch /service-orders, /service-orders/completed, etc.)
    prisma.notification.findMany({
      where: {
        userId,
        link: { startsWith: "/service-orders" },
        isRead: false
      },
      select: {
        metadata: true
      }
    }),

    // 5. Procurement Approvals (Unread Notifications)
    prisma.notification.count({
      where: {
        userId,
        link: { startsWith: "/admin/inventory" },
        isRead: false
      }
    }),

    // 6. Contractor Registration Approvals (Unread Notifications)
    prisma.notification.count({
      where: {
        userId,
        link: { startsWith: "/admin/contractors" },
        isRead: false
      }
    }),

    // 7. Material Requests (Unread Notifications)
    prisma.notification.count({
      where: {
        userId,
        link: { startsWith: "/inventory/requests" },
        isRead: false
      }
    }),

    // 8. Material Approvals (Unread Notifications)
    prisma.notification.count({
      where: {
        userId,
        link: { startsWith: "/inventory/approvals" },
        isRead: false
      }
    })
  ]);

  let serviceOrdersCount = 0;
  unreadSodNotifications.forEach(n => {
    if (n.metadata && typeof n.metadata === 'object' && !Array.isArray(n.metadata)) {
      const meta = n.metadata as Record<string, unknown>;
      if (typeof meta.count === 'number') {
        serviceOrdersCount += meta.count;
      } else {
        serviceOrdersCount += 1;
      }
    } else {
      serviceOrdersCount += 1;
    }
  });

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
