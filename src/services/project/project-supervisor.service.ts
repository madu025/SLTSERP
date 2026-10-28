import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';

export class ProjectSupervisorService {
  /**
   * Get all active supervisor assignments for a project
   */
  static async getAssignments(projectId: string) {
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
    const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { role: true, status: true } });
    const projectManagerRoles = new Set(['SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'MANAGER', 'OSP_MANAGER', 'AREA_MANAGER']);
    if (!actor || actor.status !== 'active' || !projectManagerRoles.has(actor.role)) {
      throw AppError.forbidden('Only a project manager or higher role can assign a project supervisor');
    }
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
      select: { id: true, name: true, username: true, role: true, status: true },
    });

    const supervisorRoles = new Set(['SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'MANAGER', 'OSP_MANAGER', 'AREA_MANAGER', 'ENGINEER', 'ASSISTANT_ENGINEER', 'OSP_ENGINEER', 'CIVIL_SUPERVISOR']);
    if (!supervisor || supervisor.status !== 'active') {
      throw AppError.badRequest('SUPERVISOR_NOT_FOUND');
    }
    if (!supervisorRoles.has(supervisor.role)) throw AppError.badRequest('USER_ROLE_CANNOT_SUPERVISE_PROJECT');

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
    const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { role: true, status: true } });
    const projectManagerRoles = new Set(['SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'MANAGER', 'OSP_MANAGER', 'AREA_MANAGER']);
    if (!actor || actor.status !== 'active' || !projectManagerRoles.has(actor.role)) {
      throw AppError.forbidden('Only a project manager or higher role can remove a project supervisor');
    }
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
