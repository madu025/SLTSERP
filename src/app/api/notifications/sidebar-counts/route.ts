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

  // 1. Project/Workflow approvals (assigned to this user or their role)
  const approvalsCount = await prisma.projectApprovalStep.count({
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
  });

  // 2. IT Help Desk (ITSM)
  const isITStaff = ["SUPER_ADMIN", "ADMIN", "ENGINEER", "OFFICE_ADMIN", "OFFICE_ADMIN_ASSISTANT"].includes(userRole);
  const helpdeskCount = await prisma.ticket.count({
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
  });

  // Get user's accessible OPMCs to filter counts regionally
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      accessibleOpmcs: {
        select: { id: true }
      }
    }
  });
  const accessibleOpmcIds = user?.accessibleOpmcs.map(o => o.id) || [];
  const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(userRole);

  // 3. Service Orders (Unread notification count of newly synced SODs)
  const unreadSodNotifications = await prisma.notification.findMany({
    where: {
      userId,
      link: "/service-orders",
      isRead: false
    },
    select: {
      metadata: true
    }
  });

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

  // 4. Procurement Approvals (workflowStage = REQUEST)
  const procurementApprovalsCount = await prisma.stockRequest.count({
    where: {
      workflowStage: "REQUEST",
      status: "PENDING"
    }
  });

  // 5. Contractor Registration Approvals
  const contractorApprovalsCount = await prisma.contractor.count({
    where: {
      status: {
        in: ["ARM_PENDING", "OSP_PENDING"]
      }
    }
  });

  // 6. Material Requests (created by the user)
  const materialRequestsCount = await prisma.stockRequest.count({
    where: {
      requestedById: userId,
      status: "PENDING"
    }
  });

  // 7. Material Approvals (awaiting approval from the user's role)
  let materialApprovalsCount = 0;
  if (userRole === 'SUPER_ADMIN') {
    materialApprovalsCount = await prisma.stockRequest.count({
      where: {
        status: "PENDING",
        workflowStage: {
          in: ['ARM_APPROVAL', 'STORES_MANAGER_APPROVAL', 'OSP_MANAGER_APPROVAL', 'MAIN_STORE_RELEASE', 'SUB_STORE_RECEIVE']
        }
      }
    });
  } else {
    const stage = getWorkflowStageFilter(userRole);
    materialApprovalsCount = await prisma.stockRequest.count({
      where: {
        workflowStage: stage,
        status: "PENDING"
      }
    });
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
