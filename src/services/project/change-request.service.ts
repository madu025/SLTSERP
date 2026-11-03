import { ROLE_GROUPS } from '@/config/roles';
import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { assertProjectAccess } from '@/lib/project-access';
import { getUserEffectivePermissions } from '@/lib/user-permissions';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

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
  SECTION_MANAGER: { threshold: 100000, roles: ROLE_GROUPS.ADMINS },
  AE_ENGINEER: { threshold: 500000, roles: ROLE_GROUPS.PROJECT_MANAGERS },
  FINANCE_DIRECTOR: { threshold: Infinity, roles: ROLE_GROUPS.PROJECT_MANAGERS },
};

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

    if (!approval) throw AppError.badRequest('Approval step not found');
    if (approval.status !== 'PENDING') {
      throw AppError.badRequest(`Cannot approve: step is already ${approval.status}`);
    }

    await this.assertApprovalActor(approval, userId);

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
    await this.assertApprovalActor({ ...pendingStep, changeRequest: cr }, userId);

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
    approval: { role: string; stepOrder: number; changeRequest: { projectId: string; requestedById: string | null; approvals?: Array<{ stepOrder: number; status: string }> } },
    userId: string,
  ) {
    await assertProjectAccess(approval.changeRequest.projectId, userId);

    if (approval.changeRequest.requestedById === userId) {
      throw AppError.forbidden('Segregation of Duties violation: the requester cannot approve or reject the change request');
    }

    const permissions = await getUserEffectivePermissions(userId);
    if (!permissions.includes(RBAC_PERMISSIONS.PROJECT_APPROVE)) {
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
    const actorRoles = [actor.systemRole, ...actor.sectionAssignments.map(assignment => assignment.role)]
      .filter((role): role is { code: string; isActive: boolean } => Boolean(role?.isActive))
      .flatMap(role => [role.code, role.code.replace(/_GLOBAL$/, '')]);
    const requiredRole = approval.role.trim();
    if (!isAdmin && !actorRoles.includes(requiredRole) && !actorRoles.includes(requiredRole.replace(/_GLOBAL$/, ''))) {
      throw AppError.forbidden(`User is not authorized for change-request role ${requiredRole}`);
    }

    const earlierPending = approval.changeRequest.approvals?.some(step =>
      step.stepOrder < approval.stepOrder && step.status !== 'APPROVED'
    );
    if (earlierPending) {
      throw AppError.badRequest('Previous change-request approval step is not completed');
    }
  }
}
