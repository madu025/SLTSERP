import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { assertProjectAccess } from '@/lib/project-access';
import { getUserEffectivePermissions } from '@/lib/user-permissions';
import { isCanonicalPermission, RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import {
  getChangeRequestApprovalPolicy,
  getChangeRequestPolicyVariant,
  hasEligiblePolicyRole,
} from '@/services/project/project-approval-policy.service';

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

type CanonicalChangeApprovalSnapshot = {
  requiredPermission: string | null;
  eligibleRoles: unknown;
};

/**
 * Dynamic approval chain based on cost impact:
 * < 100K → Section Manager (1 level)
 * < 500K → AE/Engineer (2 levels)
 * ≥ 500K → Finance + Director (3 levels)
 */
export class ChangeRequestService {
  /**
   * Create a change request with dynamic approval chain
   */
  static async create(input: CreateChangeRequestInput) {
    await assertProjectAccess(input.projectId, input.requestedById);
    const requesterPermissions = await getUserEffectivePermissions(input.requestedById);
    if (!requesterPermissions.includes(RBAC_PERMISSIONS.PROJECT_WRITE)) {
      throw AppError.forbidden('Project write capability is required to create a change request');
    }

    // Generate request number
    const count = await prisma.projectChangeRequest.count();
    const requestNumber = `CR-${new Date().getFullYear()}-${(count + 1).toString().padStart(4, '0')}`;

    // Resolve the approval chain from the active DB policy. The seed
    // snapshots the previous default role lists, but runtime authorization no
    // longer depends on the legacy role-group configuration.
    const costImpact = input.costImpact ?? 0;
    const policyVariant = getChangeRequestPolicyVariant(costImpact);
    const policy = await getChangeRequestApprovalPolicy(policyVariant);
    const chainRoles = policy.approvalLevels.map((level) => level.requiredRole);

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
          create: policy.approvalLevels.map((level, index) => ({
            role: level.requiredRole,
            stepOrder: index + 1,
            policyId: policy.id,
            policyVariant,
            requiredPermission: level.requiredPermission,
            eligibleRoles: level.eligibleRoles == null
              ? Prisma.JsonNull
              : level.eligibleRoles as Prisma.InputJsonValue,
            status: 'PENDING',
          })),
        },
      },
      include: {
        approvals: { orderBy: { stepOrder: 'asc' } },
      },
    });

    return { changeRequest, approvalChain: chainRoles };
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

    if (!approval) throw AppError.badRequest('Approval step not found');
    if (approval.status !== 'PENDING') {
      throw AppError.badRequest(`Cannot approve: step is already ${approval.status}`);
    }

    await this.assertApprovalActor(
      approval as typeof approval & CanonicalChangeApprovalSnapshot,
      userId,
    );

    // Update this step only after the project scope, canonical capability,
    // workflow role, ordering, and maker-checker checks above have passed.
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

    if (!cr) throw AppError.badRequest('Change request not found');
    if (cr.status !== 'SUBMITTED' && cr.status !== 'DRAFT') {
      throw AppError.badRequest(`Cannot reject: request is ${cr.status}`);
    }

    const pendingStep = await prisma.changeApproval.findFirst({
      where: { changeRequestId, status: 'PENDING' },
      orderBy: { stepOrder: 'asc' },
    });
    if (!pendingStep) throw AppError.badRequest('No pending approval step found');
    await this.assertApprovalActor(
      { ...pendingStep, changeRequest: cr } as typeof pendingStep & CanonicalChangeApprovalSnapshot & { changeRequest: typeof cr },
      userId,
    );

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
  static async submit(changeRequestId: string, userId: string) {
    const cr = await prisma.projectChangeRequest.findUnique({
      where: { id: changeRequestId },
    });

    if (!cr) throw AppError.badRequest('Change request not found');
    if (cr.status !== 'DRAFT') {
      throw AppError.badRequest(`Can only submit DRAFT requests, current: ${cr.status}`);
    }

    await assertProjectAccess(cr.projectId, userId);
    const permissions = await getUserEffectivePermissions(userId);
    if (!permissions.includes(RBAC_PERMISSIONS.PROJECT_WRITE)) {
      throw AppError.forbidden('Project write capability is required to submit a change request');
    }
    if (cr.requestedById && cr.requestedById !== userId) {
      throw AppError.forbidden('Only the change request owner can submit it');
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
  static async getForProject(projectId: string, userId: string) {
    await assertProjectAccess(projectId, userId);
    return prisma.projectChangeRequest.findMany({
      where: { projectId },
      include: {
        approvals: { orderBy: { stepOrder: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private static async assertApprovalActor(
    approval: {
      role: string;
      stepOrder: number;
      requiredPermission: string | null;
      eligibleRoles: unknown;
      changeRequest: {
        projectId: string;
        requestedById: string | null;
        approvals?: Array<{ stepOrder: number; status: string }>;
      };
    },
    userId: string,
  ) {
    await assertProjectAccess(approval.changeRequest.projectId, userId);

    if (approval.changeRequest.requestedById === userId) {
      throw AppError.forbidden('Segregation of Duties violation: the requester cannot approve or reject the change request');
    }

    const permissions = await getUserEffectivePermissions(userId);
    const requiredPermission = approval.requiredPermission;
    if (!requiredPermission || !isCanonicalPermission(requiredPermission)) {
      throw AppError.badRequest('Change-request approval is missing a canonical permission policy');
    }
    if (!permissions.includes(requiredPermission)) {
      throw AppError.forbidden('Project approval capability is required');
    }

    const actor = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        status: true,
        systemRole: { select: { code: true, isActive: true } },
        sectionAssignments: { select: { role: { select: { code: true, isActive: true } } } },
      },
    });
    if (!actor || actor.status !== 'active') {
      throw AppError.unauthorized('Authenticated approver is not active');
    }

    const isAdmin = permissions.includes(RBAC_PERMISSIONS.ADMIN_RBAC);
    const actorRoles = [actor.systemRole, ...actor.sectionAssignments.map(assignment => assignment.role)];
    if (!isAdmin && !hasEligiblePolicyRole(actorRoles, approval.eligibleRoles)) {
      throw AppError.forbidden('User is not eligible for this change-request approval level');
    }

    const earlierPending = approval.changeRequest.approvals?.some(step =>
      step.stepOrder < approval.stepOrder && step.status !== 'APPROVED'
    );
    if (earlierPending) {
      throw AppError.badRequest('Previous change-request approval step is not completed');
    }
  }
}
