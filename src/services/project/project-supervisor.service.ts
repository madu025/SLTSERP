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
      },
    });
  }

  /**
   * Assign a supervisor to a project
   */
  static async assignSupervisor(projectId: string, supervisorId: string, role?: string) {
    // 1. Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, status: true },
    });

    if (!project) {
      throw new Error('PROJECT_NOT_FOUND');
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
      throw new Error('SUPERVISOR_ALREADY_ASSIGNED');
    }

    // 3. Verify supervisor is a valid user
    const supervisor = await prisma.user.findUnique({
      where: { id: supervisorId },
      select: { id: true, name: true, role: true },
    });

    if (!supervisor) {
      throw new Error('SUPERVISOR_NOT_FOUND');
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

    return {
      ...assignment,
      supervisor: {
        id: supervisor.id,
        name: supervisor.name,
      },
    };
  }

  /**
   * Remove supervisor assignment
   */
  static async removeAssignment(projectId: string, assignmentId: string) {
    const assignment = await prisma.projectSupervisorAssignment.findFirst({
      where: { id: assignmentId, projectId },
    });

    if (!assignment) {
      throw new Error('ASSIGNMENT_NOT_FOUND');
    }

    return prisma.projectSupervisorAssignment.update({
      where: { id: assignmentId },
      data: { status: 'REMOVED' },
    });
  }
}
