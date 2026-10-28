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
        let projectTypeId = project.projectTypeId;

        // A legacy project may point at a type whose template was never seeded or was
        // deactivated.  Only retain the type when it is actually workflow-backed.
        if (projectTypeId) {
          const configuredType = await prisma.projectType.findFirst({
            where: {
              id: projectTypeId,
              workflowTemplates: { some: { isActive: true } },
            },
            select: { id: true },
          });
          if (!configuredType) projectTypeId = null;
        }

        // Fallback: Find the first project type that actually has an active template.
        // Picking an arbitrary type can still produce the same missing-workflow failure.
        if (!projectTypeId) {
          const firstType = await prisma.projectType.findFirst({
            where: { workflowTemplates: { some: { isActive: true } } },
            orderBy: { name: 'asc' },
          });
          if (firstType) {
            projectTypeId = firstType.id;
            await prisma.project.update({
              where: { id: projectId },
              data: { projectTypeId },
            });
          }
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

      // Legacy projects may have been created before workflow seeding.  Attach the
      // explicitly selected valid type while creating the workflow atomically.
      if (project.projectTypeId !== projectType.id) {
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
