import { prisma } from '@/lib/prisma';

export interface CreateChangeRequestInput {
  projectId: string;
  changeType: 'SCOPE' | 'ROUTE' | 'MATERIAL' | 'TIMELINE' | 'BUDGET';
  title: string;
  description?: string;
  costImpact?: number;
  timeImpact?: number;
  routeChangeData?: Record<string, unknown>;
  requestedById: string;
}

/**
 * Dynamic approval chain based on cost impact:
 * < 100K → Section Manager (1 level)
 * < 500K → AE/Engineer (2 levels)
 * ≥ 500K → Finance + Director (3 levels)
 */
const APPROVAL_CHAIN = {
  SECTION_MANAGER: { threshold: 100000, roles: ['SECTION_MANAGER'] },
  AE_ENGINEER: { threshold: 500000, roles: ['SECTION_MANAGER', 'AE_ENGINEER'] },
  FINANCE_DIRECTOR: { threshold: Infinity, roles: ['SECTION_MANAGER', 'AE_ENGINEER', 'FINANCE', 'DIRECTOR'] },
};

export class ChangeRequestService {
  /**
   * Create a change request with dynamic approval chain
   */
  static async create(input: CreateChangeRequestInput) {
    // Generate request number
    const count = await prisma.projectChangeRequest.count();
    const requestNumber = `CR-${new Date().getFullYear()}-${(count + 1).toString().padStart(4, '0')}`;

    // Determine approval chain by cost impact
    const costImpact = input.costImpact ?? 0;
    const chain =
      costImpact < 100000
        ? APPROVAL_CHAIN.SECTION_MANAGER
        : costImpact < 500000
        ? APPROVAL_CHAIN.AE_ENGINEER
        : APPROVAL_CHAIN.FINANCE_DIRECTOR;

    // Create change request with approval steps
    const changeRequest = await prisma.projectChangeRequest.create({
      data: {
        projectId: input.projectId,
        requestNumber,
        changeType: input.changeType,
        title: input.title,
        description: input.description,
        costImpact: input.costImpact,
        timeImpact: input.timeImpact,
        routeChangeData: input.routeChangeData ? (input.routeChangeData as object) : undefined,
        requestedById: input.requestedById,
        approvals: {
          create: chain.roles.map((role, index) => ({
            role,
            stepOrder: index + 1,
            status: 'PENDING',
          })),
        },
      },
      include: {
        approvals: { orderBy: { stepOrder: 'asc' } },
      },
    });

    return { changeRequest, approvalChain: chain.roles };
  }

  /**
   * Approve a step in the change request approval chain
   */
  static async approveStep(
    approvalId: string,
    userId: string,
    remarks?: string
  ) {
    const approval = await prisma.changeApproval.findUnique({
      where: { id: approvalId },
      include: {
        changeRequest: {
          include: { approvals: { orderBy: { stepOrder: 'asc' } } },
        },
      },
    });

    if (!approval) throw new Error('Approval step not found');
    if (approval.status !== 'PENDING') {
      throw new Error(`Cannot approve: step is already ${approval.status}`);
    }

    // Update this step
    await prisma.changeApproval.update({
      where: { id: approvalId },
      data: {
        status: 'APPROVED',
        approvedById: userId,
        approvedAt: new Date(),
        remarks,
      },
    });

    // Check if all steps approved
    const allApprovals = await prisma.changeApproval.findMany({
      where: { changeRequestId: approval.changeRequestId },
    });

    const allApproved = allApprovals.every((a) => a.status === 'APPROVED');

    if (allApproved) {
      await prisma.projectChangeRequest.update({
        where: { id: approval.changeRequestId },
        data: { status: 'APPROVED' },
      });

      // If route change, create new route version
      if (
        approval.changeRequest.changeType === 'ROUTE' &&
        approval.changeRequest.routeChangeData
      ) {
        // Route versioning handled by route-version.service.ts
      }
    }

    return { approved: true, allApproved };
  }

  /**
   * Reject a change request
   */
  static async reject(changeRequestId: string, userId: string, reason: string) {
    const cr = await prisma.projectChangeRequest.findUnique({
      where: { id: changeRequestId },
    });

    if (!cr) throw new Error('Change request not found');
    if (cr.status !== 'SUBMITTED' && cr.status !== 'DRAFT') {
      throw new Error(`Cannot reject: request is ${cr.status}`);
    }

    await prisma.projectChangeRequest.update({
      where: { id: changeRequestId },
      data: { status: 'REJECTED' },
    });

    // Reject all pending approval steps
    await prisma.changeApproval.updateMany({
      where: { changeRequestId, status: 'PENDING' },
      data: {
        status: 'REJECTED',
        approvedById: userId,
        remarks: reason,
        approvedAt: new Date(),
      },
    });

    return { rejected: true };
  }

  /**
   * Submit a draft change request for approval
   */
  static async submit(changeRequestId: string) {
    const cr = await prisma.projectChangeRequest.findUnique({
      where: { id: changeRequestId },
    });

    if (!cr) throw new Error('Change request not found');
    if (cr.status !== 'DRAFT') {
      throw new Error(`Can only submit DRAFT requests, current: ${cr.status}`);
    }

    return prisma.projectChangeRequest.update({
      where: { id: changeRequestId },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    });
  }

  /**
   * Get all change requests for a project
   */
  static async getForProject(projectId: string) {
    return prisma.projectChangeRequest.findMany({
      where: { projectId },
      include: {
        approvals: { orderBy: { stepOrder: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}