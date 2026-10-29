import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { WorkflowEngine } from '@/services/core/WorkflowEngine';
import { Prisma } from '@prisma/client';

export class ProjectWorkflowService {
  /**
   * Fetch a project's workflow instance, auto-initializing with a default template if none exists
   */
  static async getWorkflow(projectId: string) {
    let workflowInstance = await prisma.projectWorkflowInstance.findUnique({
      where: { projectId },
      include: {
        stages: {
          orderBy: { sequence: 'asc' },
          include: {
            tasks: true,
            checklists: true,
            approvals: true,
            reviews: { include: { comments: { orderBy: { createdAt: 'asc' } } }, orderBy: { revision: 'desc' } },
            outgoingHandoffs: { orderBy: { createdAt: 'desc' } },
            incomingHandoffs: { orderBy: { createdAt: 'desc' } },
          },
        },
      },
    });

    if (!workflowInstance) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { projectTypeId: true, type: true },
      });

      if (project) {
        const projectTypeId = project.projectTypeId;

        // Never guess a workflow for a legacy project.  The selected project
        // type is the business contract; attaching the first active template
        // could silently turn a CCTV/PABX project into an SSD project.
        if (!projectTypeId) {
          throw AppError.badRequest('PROJECT_TYPE_REQUIRED_FOR_WORKFLOW');
        }

        const configuredType = await prisma.projectType.findFirst({
          where: {
            id: projectTypeId,
            workflowTemplates: { some: { isActive: true } },
          },
          select: { id: true },
        });
        if (!configuredType) {
          throw AppError.badRequest('PROJECT_WORKFLOW_TEMPLATE_NOT_FOUND');
        }

        if (projectTypeId) {
          await WorkflowEngine.initializeProjectWorkflow(projectId, projectTypeId);
          workflowInstance = await prisma.projectWorkflowInstance.findUnique({
            where: { projectId },
            include: {
              stages: {
                orderBy: { sequence: 'asc' },
                include: {
                  tasks: true,
                  checklists: true,
                  approvals: true,
                  reviews: { include: { comments: { orderBy: { createdAt: 'asc' } } }, orderBy: { revision: 'desc' } },
                  outgoingHandoffs: { orderBy: { createdAt: 'desc' } },
                  incomingHandoffs: { orderBy: { createdAt: 'desc' } },
                },
              },
            },
          });
        }
      }
    }

    return workflowInstance;
  }

  /**
   * Manually initialize a project workflow
   */
  static async initializeWorkflow(projectId: string, projectTypeId: string) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.projectWorkflowInstance.findUnique({
        where: { projectId }
      });

      if (existing) {
        throw AppError.badRequest('WORKFLOW_ALREADY_INITIALIZED');
      }

      const project = await tx.project.findUnique({
        where: { id: projectId },
        select: { id: true, projectTypeId: true },
      });
      if (!project) {
        throw AppError.notFound('PROJECT_NOT_FOUND');
      }

      const projectType = await tx.projectType.findFirst({
        where: {
          id: projectTypeId,
          workflowTemplates: { some: { isActive: true } },
        },
      });
      if (!projectType) {
        throw AppError.badRequest('PROJECT_WORKFLOW_TEMPLATE_NOT_FOUND');
      }

      // A legacy project without a type may be repaired by explicitly selecting
      // one.  Never replace an already-pinned project type through this endpoint.
      if (project.projectTypeId && project.projectTypeId !== projectType.id) {
        throw AppError.conflict('PROJECT_TYPE_IMMUTABLE_AFTER_CREATION');
      }
      if (!project.projectTypeId) {
        await tx.project.update({
          where: { id: projectId },
          data: { projectTypeId: projectType.id },
        });
      }

      return WorkflowEngine.initializeProjectWorkflow(
        projectId,
        projectType.id,
        tx as unknown as Prisma.TransactionClient,
      );
    });
  }
}
