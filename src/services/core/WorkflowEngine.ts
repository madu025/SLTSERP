import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { updateProjectProgressOnStageChange } from '@/lib/project-progress';
import { ROLE_GROUPS } from '@/config/roles';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

// The application Prisma client is extended for read routing, while transaction callbacks
// expose Prisma's base transaction client.  Both have the same model operations at runtime;
// using the base contract here keeps the initializer usable inside an atomic transaction.
type WorkflowDatabase = Prisma.TransactionClient;

export class WorkflowEngine {
  /**
   * Clones a Workflow Template configuration into a concrete Project Instance.
   * Ensures that the project has an independent workflow snapshot.
   */
  static async initializeProjectWorkflow(
    projectId: string,
    projectTypeId: string,
    db: WorkflowDatabase = prisma as unknown as WorkflowDatabase,
  ) {
    // Project creation and GET-based lazy initialization can race.  Treat an existing
    // instance as success so retries do not create a second workflow or fail noisily.
    const existing = await db.projectWorkflowInstance.findUnique({
      where: { projectId },
    });
    if (existing) return existing;

    // 1. Fetch the active workflow template for this project type
    const template = await db.workflowTemplate.findFirst({
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
    let projectWorkflow;
    try {
      projectWorkflow = await db.projectWorkflowInstance.create({
        data: {
          projectId,
        },
      });
    } catch (error) {
      // Another request may have initialized the unique project workflow between the
      // existence check and create.  Reuse it; all other failures must propagate.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const concurrent = await db.projectWorkflowInstance.findUnique({ where: { projectId } });
        if (concurrent) return concurrent;
      }
      throw error;
    }

    // 3. Clone each stage template and its sub-items in batches using pre-generated IDs
    const stagesData = template.stages.map(stageTemp => {
      const generatedId = randomUUID();
      return {
        id: generatedId,
        stageTemp,
        dbData: {
          id: generatedId,
          projectWorkflowInstanceId: projectWorkflow.id,
          code: stageTemp.code,
          name: stageTemp.name,
          description: stageTemp.description,
          sequence: stageTemp.sequence,
          workstream: stageTemp.workstream,
          assignedRole: stageTemp.assignmentRole,
          assignedTeamKey: stageTemp.assignmentTeamKey,
          reviewStatus: stageTemp.reqApproval ? 'PENDING_REVIEW' : 'NOT_REQUIRED',
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
      await db.projectStageInstance.createMany({
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
          code: t.code,
          name: t.name,
          description: t.description,
          priority: t.priority,
          taskType: t.taskType,
          assignmentRole: t.assignmentRole,
          assignmentTeamKey: t.assignmentTeamKey,
          isRequired: t.isRequired,
          dependsOnCode: t.dependsOnCode,
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
      tasksData.length > 0 ? db.projectTaskInstance.createMany({ data: tasksData }) : Promise.resolve(),
      checklistsData.length > 0 ? db.projectChecklistInstance.createMany({ data: checklistsData }) : Promise.resolve(),
      approvalsData.length > 0 ? db.projectApprovalInstance.createMany({ data: approvalsData }) : Promise.resolve(),
    ]);

    // Set current stage to the first stage sequence
    const firstStage = await db.projectStageInstance.findFirst({
      where: { projectWorkflowInstanceId: projectWorkflow.id, sequence: 1 },
    });

    if (firstStage) {
      await db.projectWorkflowInstance.update({
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
      projectWorkflowInstance: {
        select: {
          projectId: true,
          project: { select: { planningSource: true } },
        },
      },
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

    // Domain gates for the delivery workflow. These are based on persisted
    // records so UI checklist completion alone cannot bypass missing evidence.
    const projectId = stage.projectWorkflowInstance.projectId;
    const stageName = stage.name.trim().toLowerCase();
    if (stageName.includes('cad drawing') || stageName.includes('cad review')) {
      const drawingCount = await prisma.projectDocument.count({ where: { projectId, category: { in: ['CAD_DRAWING', 'DRAWING', 'DESIGN'] }, status: 'APPROVED' } });
      if (drawingCount === 0) errors.push('An approved CAD/drawing document is required before continuing.');
    }
    if (stageName.includes('boq preparation')) {
      const boqCount = await prisma.projectBOQItem.count({ where: { projectId } });
      if (boqCount === 0) errors.push('At least one BOQ item is required before BOQ preparation can complete.');
    }
    if (stageName.includes('boq approval')) {
      const approvedBoq = await prisma.bOQApproval.count({ where: { projectId, status: 'APPROVED' } });
      if (approvedBoq === 0) errors.push('The BOQ must be approved before implementation can start.');
    }
    if (stageName.includes('child task') && stageName.includes('contractor')) {
      const childTasks = await prisma.projectTask.findMany({
        where: { projectId, parentId: { not: null } },
        select: { id: true, name: true, contractorId: true },
      });
      if (childTasks.length === 0) {
        errors.push('At least one child task must be created from the approved BOQ scope.');
      } else {
        const unassigned = childTasks.filter((task) => !task.contractorId);
        if (unassigned.length > 0) {
          errors.push(`Every executable child task must have a contractor: ${unassigned.map((task) => task.name).join(', ')}`);
        }
      }
    }
    if (stageName === 'implementation') {
      const openChildTasks = await prisma.projectTask.count({
        where: { projectId, parentId: { not: null }, status: { not: 'COMPLETED' } },
      });
      if (openChildTasks > 0) errors.push(`${openChildTasks} contractor child task(s) are not completed.`);
    }
    if (stageName.includes('in-house pat')) {
      const passedInHousePat = await prisma.pATSession.count({
        where: { projectId, patType: 'PRE_PAT', status: 'COMPLETED' },
      });
      if (passedInHousePat === 0) errors.push('A completed in-house PAT session is required.');
    }
    if (stageName === 'slt pat') {
      const passedSltPat = await prisma.pATSession.count({
        where: { projectId, patType: 'SLT_PAT', status: 'COMPLETED' },
      });
      if (passedSltPat === 0) errors.push('A completed SLT PAT session is required.');
    }
    if (stageName.includes('as-built')) {
      const asBuiltCount = await prisma.projectDocument.count({ where: { projectId, category: { in: ['AS_BUILT', 'CAD_AS_BUILT', 'QGIS_AS_BUILT'] }, status: 'APPROVED' } });
      const source = stage.projectWorkflowInstance.project.planningSource?.toUpperCase();
      if (asBuiltCount === 0) {
        errors.push(source === 'CAD'
          ? 'An approved CAD as-built document is required for this CAD-only project.'
          : 'An approved GIS or CAD as-built document is required.');
      }
    }
    if (stageName.includes('invoice submission') || stageName.includes('invoice & follow-up')) {
      const invoiceCount = await prisma.projectInvoice.count({
        where: {
          projectId,
          type: 'CONTRACTOR',
          status: { in: ['ISSUED', 'FOLLOW_UP', 'PARTIALLY_PAID', 'FULLY_PAID', 'PAID', 'COMPLETED'] },
        },
      });
      if (invoiceCount === 0) errors.push('At least one submitted contractor invoice is required.');
    }
    if (stageName === 'invoice follow-up') {
      const followUpCount = await prisma.projectInvoice.count({
        where: { projectId, type: 'CONTRACTOR', status: { in: ['FOLLOW_UP', 'PARTIALLY_PAID', 'FULLY_PAID', 'PAID', 'COMPLETED'] } },
      });
      if (followUpCount === 0) errors.push('At least one contractor invoice must have a follow-up or payment status.');
    }
    if (stageName.includes('invoice completed')) {
      const openInvoices = await prisma.projectInvoice.count({ where: { projectId, type: 'CONTRACTOR', status: { notIn: ['COMPLETED', 'FULLY_PAID', 'PAID'] } } });
      if (openInvoices > 0) errors.push('All contractor invoices must be fully paid or completed before project closure.');
    }

    return { success: errors.length === 0, errors };
  }

  /**
   * Promotes or completes the current stage and activates the next sequence stage.
   */
  static async transitionStage(stageId: string, nextStatus: string, userId: string, projectId?: string) {
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
      include: { approvals: true, projectWorkflowInstance: { select: { projectId: true } } },
    });

    if (!stage) {
      throw AppError.badRequest('Stage not found');
    }
    if (projectId && stage.projectWorkflowInstance.projectId !== projectId) {
      throw AppError.forbidden('Workflow stage does not belong to this project');
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
  static async updateChecklistItem(checklistId: string, isCompleted: boolean, photoUrl?: string | null, projectId?: string) {
    const checklist = await prisma.projectChecklistInstance.findUnique({
      where: { id: checklistId },
      include: { stage: { include: { projectWorkflowInstance: { select: { projectId: true } } } } },
    });
    if (!checklist) throw AppError.notFound('Workflow checklist not found');
    if (projectId && checklist.stage.projectWorkflowInstance.projectId !== projectId) throw AppError.forbidden('Workflow checklist does not belong to this project');
    return prisma.projectChecklistInstance.update({
      where: { id: checklistId },
      data: { isCompleted, photoUrl: photoUrl ?? null },
    });
  }

  /**
   * Action Task status
   */
  static async updateTaskStatus(taskId: string, status: string, progress: number = 0, projectId?: string) {
    const task = await prisma.projectTaskInstance.findUnique({
      where: { id: taskId },
      include: { stage: { include: { projectWorkflowInstance: { select: { projectId: true } } } } },
    });
    if (!task) throw AppError.notFound('Workflow task not found');
    if (projectId && task.stage.projectWorkflowInstance.projectId !== projectId) throw AppError.forbidden('Workflow task does not belong to this project');
    if (task.stage.status !== 'IN_PROGRESS') {
      throw AppError.badRequest(`Workflow stage is ${task.stage.status}; task updates are allowed only while the stage is IN_PROGRESS`);
    }
    if (progress > 0 && task.dependsOnCode) {
      const prerequisite = await prisma.projectTaskInstance.findFirst({
        where: { stageId: task.stageId, code: task.dependsOnCode },
        select: { name: true, status: true },
      });
      if (prerequisite && prerequisite.status !== 'COMPLETED') {
        throw AppError.conflict(`Prerequisite semi-task is not complete: ${prerequisite.name}`);
      }
    }
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
  static async submitApproval(approvalId: string, status: string, userId: string, comments?: string, projectId?: string) {
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
      include: { stage: { include: { approvals: true, projectWorkflowInstance: { select: { projectId: true } } } } },
    });
    if (!approval) throw AppError.notFound('Workflow approval not found');
    if (projectId && approval.stage.projectWorkflowInstance.projectId !== projectId) throw AppError.forbidden('Workflow approval does not belong to this project');
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

    return prisma.$transaction(async (tx) => {
      const updated = await tx.projectApprovalInstance.update({
        where: { id: approvalId },
        data: {
          status,
          approvedById: actor.id,
          approvedAt: new Date(),
          comments: comments || null,
        },
      });

      if (status === 'REJECTED') {
        await tx.projectStageInstance.update({
          where: { id: approval.stageId },
          data: { status: 'CHANGES_REQUESTED', reviewStatus: 'CHANGES_REQUESTED', reworkCount: { increment: 1 } },
        });
      } else {
        const remaining = await tx.projectApprovalInstance.count({
          where: { stageId: approval.stageId, status: { not: 'APPROVED' } },
        });
        if (remaining === 0) {
          await tx.projectStageInstance.update({
            where: { id: approval.stageId },
            data: { reviewStatus: 'APPROVED' },
          });
        }
      }

      return updated;
    });
  }
}
