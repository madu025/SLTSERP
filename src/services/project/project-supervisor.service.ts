import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { assertProjectAccess } from '@/lib/project-access';
import { ProjectTaskNotificationService } from '@/services/project/project-task-notification.service';
import { getUserEffectivePermissions } from '@/lib/user-permissions';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

const SUPERVISOR_ROLE_CODES = new Set([
  'CEO', 'HEAD_OF_OSP', 'MANAGER', 'OSP_MANAGER', 'AREA_MANAGER',
  'ENGINEER', 'ASSISTANT_ENGINEER', 'OSP_ENGINEER', 'CIVIL_SUPERVISOR',
]);

async function assertSupervisorManager(projectId: string, actorId: string) {
  await assertProjectAccess(projectId, actorId);
  const permissions = await getUserEffectivePermissions(actorId);
  if (!permissions.includes(RBAC_PERMISSIONS.PROJECT_PLAN_WRITE)
    && !permissions.includes(RBAC_PERMISSIONS.PROJECT_PLAN_APPROVE)) {
    throw AppError.forbidden('Project plan management capability is required');
  }
}

export class ProjectSupervisorService {
  /**
   * Get all active supervisor assignments for a project
   */
  static async getAssignments(projectId: string, viewerId?: string | null) {
    await assertProjectAccess(projectId, viewerId);
    return prisma.projectSupervisorAssignment.findMany({
      where: { projectId, status: 'ASSIGNED' },
      select: {
        id: true,
        supervisorId: true,
        role: true,
        assignedAt: true,
        supervisor: { select: { id: true, name: true, username: true, role: true } },
      },
    });
  }

  /**
   * Assign a supervisor to a project
   */
  static async assignSupervisor(projectId: string, supervisorId: string, role?: string, actorId?: string | null) {
    if (!actorId) throw AppError.unauthorized('Authenticated project manager required');
    await assertSupervisorManager(projectId, actorId);
    // 1. Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, status: true },
    });

    if (!project) {
      throw AppError.badRequest('PROJECT_NOT_FOUND');
    }

    // 2. Check for duplicate assignment
    const existing = await prisma.projectSupervisorAssignment.findFirst({
      where: {
        projectId,
        supervisorId,
        status: 'ASSIGNED',
      },
    });

    if (existing) {
      throw AppError.badRequest('SUPERVISOR_ALREADY_ASSIGNED');
    }

    // 3. Verify supervisor is a valid user
    const supervisor = await prisma.user.findUnique({
      where: { id: supervisorId },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        status: true,
        systemRole: { select: { code: true, isActive: true } },
        sectionAssignments: { select: { role: { select: { code: true, isActive: true } } } },
      },
    });

    if (!supervisor || supervisor.status !== 'active') {
      throw AppError.badRequest('SUPERVISOR_NOT_FOUND');
    }
    const supervisorRoleCodes = [supervisor.systemRole, ...supervisor.sectionAssignments.map(assignment => assignment.role)]
      .filter((candidate): candidate is { code: string; isActive: boolean } => !!candidate && candidate.isActive)
      .flatMap(candidate => [candidate.code, candidate.code.replace(/_GLOBAL$/, '')]);
    if (!supervisorRoleCodes.some(code => SUPERVISOR_ROLE_CODES.has(code))) {
      throw AppError.badRequest('USER_ROLE_CANNOT_SUPERVISE_PROJECT');
    }

    // 4. Create assignment
    const assignment = await prisma.projectSupervisorAssignment.create({
      data: {
        projectId,
        supervisorId,
        role: role || 'PRIMARY',
      },
    });

    // 5. Update project status to SURVEY_IN_PROGRESS if still PLANNING
    if (project.status === 'PLANNING') {
      await prisma.project.update({
        where: { id: projectId },
        data: { status: 'SURVEY_IN_PROGRESS' },
      });
    }

    void ProjectTaskNotificationService.notifyRoleAssigned(projectId, supervisorId, `${(role || 'PRIMARY').toLowerCase()} supervisor`, actorId);

    return {
      ...assignment,
      supervisor: {
        id: supervisor.id,
        name: supervisor.name,
        username: supervisor.username,
        role: supervisor.role,
      },
    };
  }

  /**
   * Remove supervisor assignment
   */
  static async removeAssignment(projectId: string, assignmentId: string, actorId?: string | null) {
    if (!actorId) throw AppError.unauthorized('Authenticated project manager required');
    await assertSupervisorManager(projectId, actorId);
    const assignment = await prisma.projectSupervisorAssignment.findFirst({
      where: { id: assignmentId, projectId },
    });

    if (!assignment) {
      throw AppError.badRequest('ASSIGNMENT_NOT_FOUND');
    }

    return prisma.projectSupervisorAssignment.update({
      where: { id: assignmentId },
      data: { status: 'REMOVED' },
    });
  }
}
