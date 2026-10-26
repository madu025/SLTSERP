import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { updateProjectProgressOnStageChange } from '@/lib/project-progress';
import { ROLE_GROUPS } from '@/config/roles';
import { randomUUID } from 'crypto';

export class WorkflowEngine {
  /**
   * Clones a Workflow Template configuration into a concrete Project Instance.
   * Ensures that the project has an independent workflow snapshot.
   */
  static async initializeProjectWorkflow(projectId: string, projectTypeId: string) {
    // 1. Fetch the active workflow template for this project type
    const template = await prisma.workflowTemplate.findFirst({
      where: { projectTypeId, isActive: true },
      include: {
        stages: {
          orderBy: { sequence: 'asc' },
          include: {
            taskTemplates: true,
            checklistTemplates: true,
            approvalTemplates: true,
            conditions: true,
          },
        },
      },
    });

    if (!template) {
      throw AppError.badRequest(`No active workflow template found for Project Type ID: ${projectTypeId}`);
    }

    // 2. Create the ProjectWorkflowInstance wrapper
    const projectWorkflow = await prisma.projectWorkflowInstance.create({
      data: {
        projectId,
      },
    });

    // 3. Clone each stage template and its sub-items in batches using pre-generated IDs
    const stagesData = template.stages.map(stageTemp => {
      const generatedId = randomUUID();
      return {
        id: generatedId,
        stageTemp,
        dbData: {
          id: generatedId,
          projectWorkflowInstanceId: projectWorkflow.id,
          name: stageTemp.name,
          description: stageTemp.description,
          sequence: stageTemp.sequence,
          status: stageTemp.sequence === 1 ? 'IN_PROGRESS' : 'PENDING',
          actualStart: stageTemp.sequence === 1 ? new Date() : null,
          reqApproval: stageTemp.reqApproval,
          reqChecklist: stageTemp.reqChecklist,
          reqPhotos: stageTemp.reqPhotos,
          reqMaterials: stageTemp.reqMaterials,
          reqDocuments: stageTemp.reqDocuments,
          reqOTDR: stageTemp.reqOTDR,
          reqGPS: stageTemp.reqGPS,
        }
      };
    });

    if (stagesData.length > 0) {
      await prisma.projectStageInstance.createMany({
        data: stagesData.map(s => s.dbData),
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tasksData: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const checklistsData: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const approvalsData: any[] = [];

    for (const stage of stagesData) {
      const stageTemp = stage.stageTemp;
      const stageId = stage.id;

      // Clone tasks
      if (stageTemp.taskTemplates.length > 0) {
        tasksData.push(...stageTemp.taskTemplates.map(t => ({
          stageId,
          name: t.name,
          description: t.description,
          priority: t.priority,
          status: 'PENDING',
        })));
      }

      // Clone checklists
      if (stageTemp.checklistTemplates.length > 0) {
        checklistsData.push(...stageTemp.checklistTemplates.map(c => ({
          stageId,
          label: c.label,
          isMandatory: c.isMandatory,
          isCompleted: false,
        })));
      }

      // Clone approvals
      if (stageTemp.approvalTemplates.length > 0) {
        approvalsData.push(...stageTemp.approvalTemplates.map(a => ({
          stageId,
          level: a.level,
          role: a.role,
          status: 'PENDING',
        })));
      }
    }

    // Execute bulk insertions concurrently
    await Promise.all([
      tasksData.length > 0 ? prisma.projectTaskInstance.createMany({ data: tasksData }) : Promise.resolve(),
      checklistsData.length > 0 ? prisma.projectChecklistInstance.createMany({ data: checklistsData }) : Promise.resolve(),
      approvalsData.length > 0 ? prisma.projectApprovalInstance.createMany({ data: approvalsData }) : Promise.resolve(),
    ]);

    // Set current stage to the first stage sequence
    const firstStage = await prisma.projectStageInstance.findFirst({
      where: { projectWorkflowInstanceId: projectWorkflow.id, sequence: 1 },
    });

    if (firstStage) {
      await prisma.projectWorkflowInstance.update({
        where: { id: projectWorkflow.id },
        data: { currentStageId: firstStage.id },
      });
    }

    return projectWorkflow;
  }

  /**
   * Verifies if all checklist items, photo requirements, and approvals are fulfilled
   * for a stage to allow completion.
   */
  static async validateStageCompletion(stageId: string): Promise<{ success: boolean; errors: string[] }> {
    const stage = await prisma.projectStageInstance.findUnique({
      where: { id: stageId },
      include: {
        tasks: true,
        checklists: true,
        approvals: true,
      },
    });

    if (!stage) {
      return { success: false, errors: ['Stage not found.'] };
    }

    const errors: string[] = [];

    // Check 1: Tasks completion
    const incompleteTasks = stage.tasks.filter(t => t.status !== 'COMPLETED');
    if (incompleteTasks.length > 0) {
      errors.push(`All tasks must be completed. Incomplete tasks: ${incompleteTasks.map(t => t.name).join(', ')}`);
    }

    // Check 2: Mandatory checklist items
    if (stage.reqChecklist) {
      if (stage.checklists.length === 0) {
        errors.push('Checklist requirement is enabled for this stage, but no checklist items are configured.');
      } else {
        const incompleteChecklists = stage.checklists.filter(c => c.isMandatory && !c.isCompleted);
        if (incompleteChecklists.length > 0) {
          errors.push(`Incomplete mandatory checklist: ${incompleteChecklists.map(c => c.label).join(', ')}`);
        }
      }
    }

    // Check 3: Photo upload proof requirements
    if (stage.reqPhotos) {
      if (stage.checklists.length === 0) {
        errors.push('Photo proof requirement is enabled for this stage, but no checklist items exist to attach photo proofs.');
      } else {
        const missingPhotos = stage.checklists.filter(c => {
          if (c.isMandatory) {
            // Strictly check for missing, empty, undefined, null, or placeholder URLs
            return !c.photoUrl || 
                   typeof c.photoUrl !== 'string' || 
                   c.photoUrl.trim() === '' || 
                   c.photoUrl === 'undefined' || 
                   c.photoUrl === 'null' || 
                   c.photoUrl.toLowerCase().includes('placeholder');
          }
          return false;
        });
        if (missingPhotos.length > 0) {
          errors.push(`Valid photo proof required for mandatory checklist items: ${missingPhotos.map(c => c.label).join(', ')}`);
        }
      }
    }

    // Check 4: Approvals signoff
    if (stage.reqApproval) {
      if (stage.approvals.length === 0) {
        errors.push('Approval requirement is enabled for this stage, but no approval flows have been configured or assigned.');
      } else {
        const unapproved = stage.approvals.filter(a => a.status !== 'APPROVED');
        if (unapproved.length > 0) {
          errors.push(`Requires approval at Level ${unapproved.map(a => `${a.level} (${a.role})`).join(', ')}`);
        }
      }
    }

    return {
      success: errors.length === 0,
      errors,
    };
  }

  /**
   * Promotes or completes the current stage and activates the next sequence stage.
   */
  static async transitionStage(stageId: string, nextStatus: string, userId: string) {
    const actor = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, status: true },
    });
    if (!actor || actor.status !== 'active') {
      throw AppError.unauthorized('Authenticated workflow actor is not active');
    }

    const allowedStatuses = new Set(['COMPLETED', 'BLOCKED', 'ON_HOLD', 'IN_PROGRESS']);
    if (!allowedStatuses.has(nextStatus)) {
      throw AppError.badRequest('Invalid workflow stage status');
    }

    const stage = await prisma.projectStageInstance.findUnique({
      where: { id: stageId },
      include: { approvals: true },
    });

    if (!stage) {
      throw AppError.badRequest('Stage not found');
    }

    const isAdmin = ROLE_GROUPS.ADMINS.includes(actor.role);
    const hasConfiguredApprovalRole = stage.approvals.some((approval) => approval.role === actor.role);
    const isProjectOwner = ROLE_GROUPS.AREA_MANAGERS.includes(actor.role);
    if (!isAdmin && !hasConfiguredApprovalRole && !isProjectOwner) {
        throw AppError.forbidden('User is not authorized to transition workflow stages');
    }

    if (nextStatus === 'COMPLETED') {
      const validation = await this.validateStageCompletion(stageId);
      if (!validation.success) {
        throw AppError.badRequest(`Gate validation failed:\n- ${validation.errors.join('\n- ')}`);
      }

      // Complete current stage
      await prisma.projectStageInstance.update({
        where: { id: stageId },
        data: {
          status: 'COMPLETED',
          actualFinish: new Date(),
        },
      });

      // Log Audit
      await prisma.workflowAuditLog.create({
        data: {
          userId,
          action: 'STAGE_COMPLETED',
          entityType: 'ProjectStageInstance',
          entityId: stageId,
          details: { stageName: stage.name },
        },
      });

      // Find next stage in sequence
      const nextStage = await prisma.projectStageInstance.findFirst({
        where: {
          projectWorkflowInstanceId: stage.projectWorkflowInstanceId,
          sequence: stage.sequence + 1,
        },
      });

      if (nextStage) {
        await prisma.projectStageInstance.update({
          where: { id: nextStage.id },
          data: {
            status: 'IN_PROGRESS',
            actualStart: new Date(),
          },
        });

        await prisma.projectWorkflowInstance.update({
          where: { id: stage.projectWorkflowInstanceId },
          data: { currentStageId: nextStage.id },
        });

        // Log Audit
        await prisma.workflowAuditLog.create({
          data: {
            userId,
            action: 'STAGE_STARTED',
            entityType: 'ProjectStageInstance',
            entityId: nextStage.id,
            details: { stageName: nextStage.name },
          },
        });
      }

      // Auto-update project progress after stage completion
      const workflowInstance = await prisma.projectWorkflowInstance.findUnique({
        where: { id: stage.projectWorkflowInstanceId },
        select: { projectId: true }
      });
      if (workflowInstance?.projectId) {
        await updateProjectProgressOnStageChange(workflowInstance.projectId);
      }
    } else {
      // Manual status adjustments (e.g. BLOCKED, ON_HOLD)
      await prisma.projectStageInstance.update({
        where: { id: stageId },
        data: { status: nextStatus },
      });

      await prisma.workflowAuditLog.create({
        data: {
          userId,
          action: `STAGE_STATUS_SET_${nextStatus.toUpperCase()}`,
          entityType: 'ProjectStageInstance',
          entityId: stageId,
        },
      });
    }
  }

  /**
   * Action Checklist items
   */
  static async updateChecklistItem(checklistId: string, isCompleted: boolean, photoUrl?: string) {
    return prisma.projectChecklistInstance.update({
      where: { id: checklistId },
      data: { isCompleted, photoUrl },
    });
  }

  /**
   * Action Task status
   */
  static async updateTaskStatus(taskId: string, status: string, progress: number = 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = { status, progress };
    if (status === 'IN_PROGRESS') {
      data.actualStart = new Date();
    } else if (status === 'COMPLETED') {
      data.actualFinish = new Date();
      data.progress = 100;
    }
    return prisma.projectTaskInstance.update({
      where: { id: taskId },
      data,
    });
  }

  /**
   * Action Approval Level
   */
  static async submitApproval(approvalId: string, status: string, userId: string, comments?: string) {
    if (status !== 'APPROVED' && status !== 'REJECTED') {
      throw AppError.badRequest('Approval status must be APPROVED or REJECTED');
    }

    const actor = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, status: true },
    });
    if (!actor || actor.status !== 'active') {
      throw AppError.unauthorized('Authenticated approver is not active');
    }

    const approval = await prisma.projectApprovalInstance.findUnique({
      where: { id: approvalId },
      include: { stage: { include: { approvals: true } } },
    });
    if (!approval) throw AppError.notFound('Workflow approval not found');
    if (approval.status !== 'PENDING') {
      throw AppError.badRequest('Workflow approval has already been actioned');
    }

    const isAdmin = ROLE_GROUPS.ADMINS.includes(actor.role);
    if (!isAdmin && approval.role !== actor.role) {
      throw AppError.forbidden('User is not eligible for this approval level');
    }

    const priorPending = approval.stage.approvals.some(
      (item) => item.level < approval.level && item.status !== 'APPROVED'
    );
    if (priorPending) {
      throw AppError.badRequest('Previous approval levels must be completed first');
    }

    return prisma.projectApprovalInstance.update({
      where: { id: approvalId },
      data: {
        status,
        approvedById: actor.id,
        approvedAt: new Date(),
        comments: comments || null,
      },
    });
  }
}
