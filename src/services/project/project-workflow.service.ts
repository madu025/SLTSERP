import { prisma } from '@/lib/prisma';
import { WorkflowEngine } from '@/services/WorkflowEngine';

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

        // Fallback: Find first project type if not explicitly set
        if (!projectTypeId) {
          const firstType = await prisma.projectType.findFirst();
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
    const existing = await prisma.projectWorkflowInstance.findUnique({
      where: { projectId }
    });

    if (existing) {
      throw new Error('WORKFLOW_ALREADY_INITIALIZED');
    }

    return WorkflowEngine.initializeProjectWorkflow(projectId, projectTypeId);
  }
}
