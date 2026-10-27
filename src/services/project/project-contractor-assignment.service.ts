import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';

export class ProjectContractorAssignmentService {
  static async list(projectId: string) {
    return prisma.projectContractorAssignment.findMany({
      where: { projectId },
      include: { contractor: { select: { id: true, name: true, contactNumber: true, email: true } } },
      orderBy: { assignedAt: 'asc' },
    });
  }

  static async assign(data: { projectId: string; contractorId: string; role?: string; allocationPercent?: number | null; contractValue?: number | null; notes?: string | null }) {
    const [project, contractor] = await Promise.all([
      prisma.project.findUnique({ where: { id: data.projectId }, select: { id: true } }),
      prisma.contractor.findUnique({ where: { id: data.contractorId }, select: { id: true, status: true } }),
    ]);
    if (!project) throw AppError.notFound('PROJECT_NOT_FOUND');
    if (!contractor || contractor.status !== 'ACTIVE') throw AppError.badRequest('ACTIVE_CONTRACTOR_REQUIRED');
    if (data.allocationPercent !== undefined && data.allocationPercent !== null && (data.allocationPercent <= 0 || data.allocationPercent > 100)) {
      throw AppError.badRequest('INVALID_CONTRACTOR_ALLOCATION');
    }

    return prisma.projectContractorAssignment.upsert({
      where: { projectId_contractorId: { projectId: data.projectId, contractorId: data.contractorId } },
      create: {
        projectId: data.projectId,
        contractorId: data.contractorId,
        role: data.role || 'IMPLEMENTATION',
        allocationPercent: data.allocationPercent ?? null,
        contractValue: data.contractValue ?? null,
        notes: data.notes || null,
        status: 'ACTIVE',
      },
      update: {
        role: data.role || 'IMPLEMENTATION',
        allocationPercent: data.allocationPercent ?? null,
        contractValue: data.contractValue ?? null,
        notes: data.notes || null,
        status: 'ACTIVE',
        releasedAt: null,
      },
      include: { contractor: { select: { id: true, name: true, contactNumber: true, email: true } } },
    });
  }

  static async release(id: string) {
    const assignment = await prisma.projectContractorAssignment.findUnique({ where: { id } });
    if (!assignment) throw AppError.notFound('CONTRACTOR_ASSIGNMENT_NOT_FOUND');
    const activeTasks = await prisma.projectTask.count({ where: { contractorAssignmentId: id, status: { not: 'COMPLETED' } } });
    if (activeTasks > 0) throw AppError.badRequest('CANNOT_RELEASE_CONTRACTOR_WITH_OPEN_TASKS');
    return prisma.projectContractorAssignment.update({ where: { id }, data: { status: 'RELEASED', releasedAt: new Date() } });
  }

  /**
   * Replace a contractor during an active project. Completed tasks remain linked
   * to the original contractor for audit/invoice history; only open tasks move
   * to the replacement assignment.
   */
  static async replace(id: string, replacementContractorId: string) {
    return prisma.$transaction(async (tx) => {
      const current = await tx.projectContractorAssignment.findUnique({ where: { id } });
      if (!current || current.status !== 'ACTIVE') throw AppError.badRequest('ACTIVE_CONTRACTOR_ASSIGNMENT_REQUIRED');
      if (current.contractorId === replacementContractorId) throw AppError.badRequest('REPLACEMENT_CONTRACTOR_MUST_DIFFER');

      const replacement = await tx.contractor.findUnique({
        where: { id: replacementContractorId },
        select: { id: true, status: true },
      });
      if (!replacement || replacement.status !== 'ACTIVE') throw AppError.badRequest('ACTIVE_CONTRACTOR_REQUIRED');

      const nextAssignment = await tx.projectContractorAssignment.upsert({
        where: { projectId_contractorId: { projectId: current.projectId, contractorId: replacementContractorId } },
        create: {
          projectId: current.projectId,
          contractorId: replacementContractorId,
          role: current.role,
          allocationPercent: current.allocationPercent,
          contractValue: current.contractValue,
          notes: current.notes,
          status: 'ACTIVE',
          releasedAt: null,
        },
        update: {
          role: current.role,
          status: 'ACTIVE',
          releasedAt: null,
        },
      });

      const movedTasks = await tx.projectTask.updateMany({
        where: { contractorAssignmentId: id, status: { not: 'COMPLETED' } },
        data: { contractorId: replacementContractorId, contractorAssignmentId: nextAssignment.id },
      });

      await tx.projectContractorAssignment.update({
        where: { id },
        data: { status: 'RELEASED', releasedAt: new Date(), notes: `${current.notes || ''}\nReplaced by ${replacementContractorId}`.trim() },
      });

      // Keep the legacy primary-contractor field in sync when the replaced
      // assignment was also the project's primary contractor.
      await tx.project.updateMany({
        where: { id: current.projectId, contractorId: current.contractorId },
        data: { contractorId: replacementContractorId },
      });

      return { assignmentId: id, replacementAssignmentId: nextAssignment.id, movedTaskCount: movedTasks.count };
    });
  }
}
