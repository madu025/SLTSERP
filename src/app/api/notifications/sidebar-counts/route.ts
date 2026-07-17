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
    // 1. Project/Workflow approvals
    prisma.projectApprovalStep.count({
      where: {
        status: "PENDING",
        OR: [
          { assignedUserId: userId },
          {
            AND: [
              { assignedUserId: null },
              { roleRequired: userRole }
            ]
          }
        ]
      }
    }),

    // 2. IT Help Desk
    prisma.ticket.count({
      where: isITStaff
        ? {
            status: {
              in: ["OPEN", "ASSIGNED", "IN_PROGRESS", "WAITING_FOR_USER", "WAITING_FOR_PARTS"]
            }
          }
        : {
            userId,
            status: {
              in: ["OPEN", "ASSIGNED", "IN_PROGRESS", "WAITING_FOR_USER", "WAITING_FOR_PARTS"]
            }
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

    // 4. Service Orders notifications
    prisma.notification.findMany({
      where: {
        userId,
        link: "/service-orders",
        isRead: false
      },
      select: {
        metadata: true
      }
    }),

    // 5. Procurement Approvals
    prisma.stockRequest.count({
      where: {
        workflowStage: "REQUEST",
        status: "PENDING"
      }
    }),

    // 6. Contractor Registration Approvals
    prisma.contractor.count({
      where: {
        status: {
          in: ["ARM_PENDING", "OSP_PENDING"]
        }
      }
    }),

    // 7. Material Requests
    prisma.stockRequest.count({
      where: {
        requestedById: userId,
        status: "PENDING"
      }
    }),

    // 8. Material Approvals
    userRole === 'SUPER_ADMIN'
      ? prisma.stockRequest.count({
          where: {
            status: "PENDING",
            workflowStage: {
              in: ['ARM_APPROVAL', 'STORES_MANAGER_APPROVAL', 'OSP_MANAGER_APPROVAL', 'MAIN_STORE_RELEASE', 'SUB_STORE_RECEIVE']
            }
          }
        })
      : prisma.stockRequest.count({
          where: {
            workflowStage: stage,
            status: "PENDING"
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
