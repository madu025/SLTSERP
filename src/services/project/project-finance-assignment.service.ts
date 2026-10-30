import { AppError } from '@/lib/error';
import { deriveEffectivePermissions } from '@/lib/effective-permissions';
import { prisma } from '@/lib/prisma';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

export const PROJECT_FINANCE_ASSIGNMENT_ROLES = [
  'LEAD_CONTROLLER',
  'PREPARER',
  'REVIEWER',
  'APPROVER',
] as const;

export type ProjectFinanceAssignmentRole = typeof PROJECT_FINANCE_ASSIGNMENT_ROLES[number];
export type ProjectFinanceAssignmentStatus = 'ACTIVE' | 'ENDED';

const roleRequirements: Record<ProjectFinanceAssignmentRole, readonly string[]> = {
  LEAD_CONTROLLER: [RBAC_PERMISSIONS.PROJECT_FINANCE_WRITE, RBAC_PERMISSIONS.FINANCE_WRITE, RBAC_PERMISSIONS.PROJECT_FINANCE_APPROVE],
  PREPARER: [RBAC_PERMISSIONS.PROJECT_FINANCE_WRITE, RBAC_PERMISSIONS.FINANCE_WRITE],
  REVIEWER: [RBAC_PERMISSIONS.PROJECT_FINANCE_READ, RBAC_PERMISSIONS.FINANCE_AUDIT],
  APPROVER: [RBAC_PERMISSIONS.PROJECT_FINANCE_APPROVE, RBAC_PERMISSIONS.FINANCE_APPROVE],
};

const financePermissionCodes = [
  RBAC_PERMISSIONS.PROJECT_FINANCE_READ,
  RBAC_PERMISSIONS.PROJECT_FINANCE_WRITE,
  RBAC_PERMISSIONS.PROJECT_FINANCE_APPROVE,
  RBAC_PERMISSIONS.FINANCE_READ,
  RBAC_PERMISSIONS.FINANCE_WRITE,
  RBAC_PERMISSIONS.FINANCE_APPROVE,
  RBAC_PERMISSIONS.FINANCE_AUDIT,
] as const;

const userPermissionSelect = {
  permissions: true,
  systemRole: {
    select: {
      isActive: true,
      permissions: true,
      rolePermissions: { select: { permission: true, permissionDefinition: { select: { code: true } } } },
    },
  },
  sectionAssignments: {
    select: {
      role: {
        select: {
          isActive: true,
          permissions: true,
          rolePermissions: { select: { permission: true, permissionDefinition: { select: { code: true } } } },
        },
      },
    },
  },
} as const;

function assertAssignmentRole(value: string): asserts value is ProjectFinanceAssignmentRole {
  if (!PROJECT_FINANCE_ASSIGNMENT_ROLES.includes(value as ProjectFinanceAssignmentRole)) {
    throw AppError.badRequest(`Unsupported project finance assignment role: ${value}`);
  }
}

async function getProject(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, opmcId: true },
  });
  if (!project) throw AppError.notFound('Project not found');
  return project;
}

async function assertUserCanWorkInProjectScope(userId: string, opmcId: string | null) {
  const scope = await resolveOpmcScope(userId);
  if (scope !== undefined && (!opmcId || !scope.includes(opmcId))) {
    throw AppError.badRequest('The selected user is not assigned to this project OPMC scope');
  }
}

async function getEffectiveUserPermissions(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      status: true,
      accessibleOpmcs: { select: { id: true } },
      ...userPermissionSelect,
    },
  });
  if (!user || user.status !== 'active') throw AppError.badRequest('The selected user is not active');
  return { user, permissions: deriveEffectivePermissions(user) };
}

export class ProjectFinanceAssignmentService {
  static async list(projectId: string, includeCandidates = false) {
    const project = await getProject(projectId);
    const assignments = await prisma.projectFinanceAssignment.findMany({
      where: { projectId },
      orderBy: [
        { status: 'asc' },
        { isPrimary: 'desc' },
        { assignmentRole: 'asc' },
        { createdAt: 'asc' },
      ],
      include: {
        user: { select: { id: true, name: true, username: true, email: true } },
        assignedBy: { select: { id: true, name: true, username: true } },
      },
    });

    if (!includeCandidates) return { assignments };

    const users = await prisma.user.findMany({
      where: { status: 'active' },
      take: 500,
      orderBy: [{ name: 'asc' }, { username: 'asc' }],
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        status: true,
        accessibleOpmcs: { select: { id: true } },
        ...userPermissionSelect,
      },
    });

    const candidates = users
      .map((user) => ({ user, permissions: deriveEffectivePermissions(user) }))
      .filter(({ user, permissions }) => {
        const hasFinanceCapability = financePermissionCodes.some((permission) => permissions.includes(permission));
        const hasScope = permissions.includes(RBAC_PERMISSIONS.ADMIN_RBAC)
          || (!!project.opmcId && user.accessibleOpmcs.some((opmc) => opmc.id === project.opmcId));
        return hasFinanceCapability && hasScope;
      })
      .map(({ user, permissions }) => ({
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        capabilities: financePermissionCodes.filter((permission) => permissions.includes(permission)),
      }));

    return { assignments, candidates };
  }

  static async assign(input: {
    projectId: string;
    userId: string;
    assignmentRole: string;
    isPrimary?: boolean;
    startsAt?: string;
    notes?: string | null;
    assignedById: string;
  }) {
    assertAssignmentRole(input.assignmentRole);
    const project = await getProject(input.projectId);
    await assertUserCanWorkInProjectScope(input.assignedById, project.opmcId);
    await assertUserCanWorkInProjectScope(input.userId, project.opmcId);

    const { permissions } = await getEffectiveUserPermissions(input.userId);
    const requirements = roleRequirements[input.assignmentRole];
    if (!requirements.some((permission) => permissions.includes(permission))) {
      throw AppError.badRequest(`Selected user does not have the capability required for ${input.assignmentRole}`);
    }

    const startsAt = input.startsAt ? new Date(input.startsAt) : new Date();
    if (Number.isNaN(startsAt.getTime())) throw AppError.badRequest('startsAt must be a valid date');

    return prisma.$transaction(async (tx) => {
      if (input.isPrimary) {
        await tx.projectFinanceAssignment.updateMany({
          where: { projectId: input.projectId, status: 'ACTIVE', isPrimary: true },
          data: { isPrimary: false },
        });
      }

      return tx.projectFinanceAssignment.upsert({
        where: {
          projectId_userId_assignmentRole: {
            projectId: input.projectId,
            userId: input.userId,
            assignmentRole: input.assignmentRole,
          },
        },
        create: {
          projectId: input.projectId,
          userId: input.userId,
          assignmentRole: input.assignmentRole,
          status: 'ACTIVE',
          isPrimary: input.isPrimary ?? false,
          startsAt,
          notes: input.notes ?? null,
          assignedById: input.assignedById,
        },
        update: {
          status: 'ACTIVE',
          isPrimary: input.isPrimary ?? false,
          startsAt,
          endsAt: null,
          notes: input.notes ?? null,
          assignedById: input.assignedById,
        },
        include: {
          user: { select: { id: true, name: true, username: true, email: true } },
          assignedBy: { select: { id: true, name: true, username: true } },
        },
      });
    });
  }

  static async update(input: {
    id: string;
    status: ProjectFinanceAssignmentStatus;
    isPrimary?: boolean;
    notes?: string | null;
    actorId: string;
  }) {
    const assignment = await prisma.projectFinanceAssignment.findUnique({
      where: { id: input.id },
      select: { id: true, projectId: true },
    });
    if (!assignment) throw AppError.notFound('Project finance assignment not found');
    const project = await getProject(assignment.projectId);
    await assertUserCanWorkInProjectScope(input.actorId, project.opmcId);

    return prisma.$transaction(async (tx) => {
      if (input.status === 'ENDED' || input.isPrimary === false) {
        await tx.projectFinanceAssignment.update({
          where: { id: input.id },
          data: {
            status: input.status,
            isPrimary: false,
            endsAt: input.status === 'ENDED' ? new Date() : null,
            notes: input.notes ?? undefined,
          },
        });
      } else {
        if (input.isPrimary) {
          await tx.projectFinanceAssignment.updateMany({
            where: { projectId: assignment.projectId, status: 'ACTIVE', isPrimary: true, id: { not: input.id } },
            data: { isPrimary: false },
          });
        }
        await tx.projectFinanceAssignment.update({
          where: { id: input.id },
          data: {
            status: input.status,
            isPrimary: input.isPrimary ?? undefined,
            endsAt: null,
            notes: input.notes ?? undefined,
          },
        });
      }

      return tx.projectFinanceAssignment.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          user: { select: { id: true, name: true, username: true, email: true } },
          assignedBy: { select: { id: true, name: true, username: true } },
        },
      });
    });
  }
}
