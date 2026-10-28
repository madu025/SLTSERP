import { Prisma, PrismaClient, Role } from '@prisma/client';
import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { normalizeTaskSchedule } from '@/lib/project-schedule';

const EDITABLE_PLAN_STATUSES = new Set(['DRAFT', 'CHANGES_REQUESTED']);
const PROJECT_SUPERVISOR_ROLES = ['SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'MANAGER', 'OSP_MANAGER', 'AREA_MANAGER', 'ENGINEER', 'ASSISTANT_ENGINEER', 'OSP_ENGINEER', 'CIVIL_SUPERVISOR'] as Role[];
const db = prisma as unknown as PrismaClient;

function asOptionalString(value: unknown) {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    return normalized || null;
}

function asOptionalDate(value: unknown) {
    if (value === null || value === undefined || value === '') return null;
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) throw AppError.badRequest('Invalid task plan date');
    return date;
}

function safeCode(value: string) {
    return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60) || 'TASK';
}

function addDays(date: Date, days: number) {
    const next = new Date(date);
    next.setDate(next.getDate() + Math.max(0, days));
    return next;
}

async function getProject(projectId: string) {
    const project = await db.project.findUnique({
        where: { id: projectId },
        select: { id: true, projectTypeId: true, opmcId: true, startDate: true, endDate: true },
    });
    if (!project) throw AppError.notFound('PROJECT_NOT_FOUND');
    if (!project.projectTypeId) throw AppError.badRequest('PROJECT_TYPE_REQUIRED_FOR_TASK_PLAN');
    return { ...project, projectTypeId: project.projectTypeId };
}

async function assertEditable(planId: string) {
    const plan = await db.projectTaskPlan.findUnique({ where: { id: planId }, select: { id: true, projectId: true, status: true } });
    if (!plan) throw AppError.notFound('TASK_PLAN_NOT_FOUND');
    if (!EDITABLE_PLAN_STATUSES.has(plan.status)) throw AppError.conflict('TASK_PLAN_LOCKED_AFTER_APPROVAL');
    return plan;
}

async function assertAssignedUser(projectId: string, userId: string | null, requiredJobRole: string | null) {
    if (!userId) return null;
    const [project, user] = await Promise.all([
        db.project.findUnique({ where: { id: projectId }, select: { opmcId: true } }),
        db.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, role: true, status: true, accessibleOpmcs: { select: { id: true } } },
        }),
    ]);
    if (!user || user.status !== 'active') throw AppError.badRequest('TASK_ASSIGNEE_NOT_ACTIVE');
    if (requiredJobRole && user.role !== requiredJobRole) {
        throw AppError.badRequest(`TASK_USER_ROLE_MISMATCH:${requiredJobRole}`);
    }
    if (project?.opmcId && !user.accessibleOpmcs.some(opmc => opmc.id === project.opmcId)) {
        throw AppError.forbidden('TASK_ASSIGNEE_OUTSIDE_PROJECT_OPMC_SCOPE');
    }
    return user;
}

async function assertAssignedContractor(projectId: string, contractorId: string | null) {
    if (!contractorId) return null;
    const assignment = await db.projectContractorAssignment.findUnique({
        where: { projectId_contractorId: { projectId, contractorId } },
        select: { contractorId: true, status: true },
    });
    if (!assignment || assignment.status !== 'ACTIVE') throw AppError.badRequest('CONTRACTOR_MUST_BE_ASSIGNED_TO_PROJECT');
    return assignment;
}

async function assertPlanDesigner(projectId: string, actorId: string) {
    const assignment = await db.projectSupervisorAssignment.findFirst({ where: { projectId, supervisorId: actorId, status: 'ASSIGNED' }, select: { id: true } });
    if (assignment) return;
    const actor = await db.user.findUnique({ where: { id: actorId }, select: { role: true, status: true } });
    const managementRoles = new Set(['SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'MANAGER', 'OSP_MANAGER', 'AREA_MANAGER', 'ENGINEER', 'ASSISTANT_ENGINEER']);
    if (!actor || actor.status !== 'active' || !managementRoles.has(actor.role)) throw AppError.forbidden('Only the assigned project supervisor or project management can configure this task plan');
}

export class ProjectTaskPlanService {
    static async getPlan(projectId: string) {
        const project = await getProject(projectId);
        const plan = await db.projectTaskPlan.findUnique({
                where: { projectId },
                include: {
                    items: {
                        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
                        include: {
                            sourceTemplate: { include: { stageTemplate: { select: { code: true, name: true, sequence: true } } } },
                            sourceBoqItem: { select: { id: true, itemCode: true, description: true, category: true, quantity: true, unit: true, contractorId: true } },
                            assignedUser: { select: { id: true, name: true, username: true, role: true } },
                            assignedContractor: { select: { id: true, name: true } },
                            children: { select: { id: true } },
                        },
                    },
                },
            });
        const template = await db.workflowTemplate.findFirst({ where: { projectTypeId: project.projectTypeId, isActive: true }, select: { id: true, name: true } });
        const stages = template ? await db.workflowStageTemplate.findMany({
            where: { workflowTemplateId: template.id },
            orderBy: { sequence: 'asc' },
            select: {
                code: true,
                name: true,
                sequence: true,
                taskTemplates: {
                    where: { isSupervisorSelectable: true },
                    orderBy: { id: 'asc' },
                    select: { id: true, code: true, name: true, description: true, priority: true, taskType: true, assignmentRole: true, assignmentTeamKey: true, isRequired: true, defaultDurationDays: true, executionType: true },
                },
            },
        }) : [];
        const candidateRoles = [...new Set(stages.flatMap(stage => stage.taskTemplates.map(task => task.assignmentRole).filter((role): role is string => Boolean(role))))];
        const users = await db.user.findMany({
            where: {
                status: 'active',
                ...(candidateRoles.length ? { role: { in: candidateRoles as Role[] } } : {}),
                ...(project.opmcId ? { accessibleOpmcs: { some: { id: project.opmcId } } } : {}),
            },
            select: { id: true, name: true, username: true, role: true },
            orderBy: [{ role: 'asc' }, { name: 'asc' }],
        });
        const supervisorCandidates = await db.user.findMany({
            where: {
                status: 'active',
                role: { in: PROJECT_SUPERVISOR_ROLES },
                ...(project.opmcId ? { accessibleOpmcs: { some: { id: project.opmcId } } } : {}),
            },
            select: { id: true, name: true, username: true, role: true },
            orderBy: [{ role: 'asc' }, { name: 'asc' }],
        });
        const contractors = await db.projectContractorAssignment.findMany({
            where: { projectId, status: 'ACTIVE' },
            select: { contractorId: true, contractor: { select: { id: true, name: true } } },
            orderBy: { contractor: { name: 'asc' } },
        });

        return {
            plan,
            workflowTemplate: template ? { id: template.id, name: template.name } : null,
            users,
            supervisorCandidates,
            contractors,
            catalog: stages.flatMap(stage => stage.taskTemplates.map(task => ({
                id: task.id,
                code: `${stage.code || `STAGE_${stage.sequence}`}_${task.code || task.id.slice(0, 8)}`,
                name: task.name,
                description: task.description,
                priority: task.priority,
                taskType: task.taskType,
                requiredJobRole: task.assignmentRole,
                assignmentTeamKey: task.assignmentTeamKey,
                isRequired: task.isRequired,
                defaultDurationDays: task.defaultDurationDays,
                executionType: task.executionType,
                stageCode: stage.code,
                stageName: stage.name,
                stageSequence: stage.sequence,
            }))) || [],
        };
    }

    static async initialize(projectId: string, actorId: string, enforceDesigner = true) {
        if (enforceDesigner) await assertPlanDesigner(projectId, actorId);
        const project = await getProject(projectId);
        const template = await db.workflowTemplate.findFirst({ where: { projectTypeId: project.projectTypeId, isActive: true }, select: { id: true } });
        if (!template) throw AppError.badRequest('PROJECT_WORKFLOW_TEMPLATE_NOT_FOUND');
        const stages = await db.workflowStageTemplate.findMany({
            where: { workflowTemplateId: template.id },
            orderBy: { sequence: 'asc' },
            include: { taskTemplates: { where: { isSupervisorSelectable: true }, orderBy: { id: 'asc' } } },
        });

        return db.$transaction(async tx => {
            const existing = await tx.projectTaskPlan.findUnique({ where: { projectId }, select: { id: true } });
            if (existing) return tx.projectTaskPlan.findUnique({ where: { id: existing.id }, include: { items: true } });

            const plan = await tx.projectTaskPlan.create({ data: { projectId, status: 'DRAFT', version: 1, configuredById: actorId, configuredAt: new Date() } });
            const rows = stages.flatMap(stage => stage.taskTemplates.map((task, index) => ({
                planId: plan.id,
                sourceTemplateId: task.id,
                code: `${stage.code || `STAGE_${stage.sequence}`}_${task.code || task.id.slice(0, 8)}`,
                name: task.name,
                description: task.description,
                sourceType: 'TEMPLATE',
                taskType: task.taskType,
                requiredJobRole: task.assignmentRole,
                assignmentTeamKey: task.assignmentTeamKey,
                enabled: true,
                isRequired: task.isRequired,
                sortOrder: stage.sequence * 1000 + index,
                plannedDurationDays: task.defaultDurationDays,
            })));
            if (rows.length) await tx.projectTaskPlanItem.createMany({ data: rows });
            return tx.projectTaskPlan.findUnique({ where: { id: plan.id }, include: { items: { orderBy: { sortOrder: 'asc' } } } });
        });
    }

    static async syncApprovedBoq(projectId: string, actorId: string, options?: { automation?: boolean }) {
        const automated = options?.automation === true;
        if (!automated) await assertPlanDesigner(projectId, actorId);
        const project = await getProject(projectId);
        const approval = await db.bOQApproval.findFirst({ where: { projectId, status: 'APPROVED' }, select: { id: true } });
        if (!approval) throw AppError.badRequest('BOQ_APPROVAL_REQUIRED_FOR_TASK_PLAN');
        const plan = await this.initialize(projectId, actorId, !automated);
        if (!plan) throw AppError.internal('TASK_PLAN_INITIALIZATION_FAILED');
        await assertEditable(plan.id);

        const items = await db.projectBOQItem.findMany({ where: { projectId }, orderBy: [{ category: 'asc' }, { itemCode: 'asc' }] });
        await db.$transaction(async tx => {
            let boqRoot = await tx.projectTaskPlanItem.findFirst({ where: { planId: plan.id, code: 'BOQ_WORK_PACKAGES' }, select: { id: true } });
            if (!boqRoot) {
                boqRoot = await tx.projectTaskPlanItem.create({
                    data: {
                        planId: plan.id,
                        code: 'BOQ_WORK_PACKAGES',
                        name: 'Approved BOQ Work Packages',
                        description: 'Container for executable work packages generated from the approved BOQ.',
                        sourceType: 'CONTAINER',
                        taskType: 'PHASE',
                        enabled: true,
                        isRequired: false,
                        sortOrder: 899999,
                    },
                    select: { id: true },
                });
            }
            for (let index = 0; index < items.length; index += 1) {
                const boq = items[index];
                const exists = await tx.projectTaskPlanItem.findFirst({ where: { planId: plan.id, sourceBoqItemId: boq.id }, select: { id: true } });
                if (exists) continue;
                await tx.projectTaskPlanItem.create({
                    data: {
                        planId: plan.id,
                        sourceBoqItemId: boq.id,
                        code: `BOQ_${safeCode(boq.itemCode)}_${boq.id.slice(0, 8)}`,
                        name: `${boq.itemCode} · ${boq.description}`,
                        description: `BOQ work package${boq.category ? ` · ${boq.category}` : ''}`,
                        sourceType: 'BOQ_WORK_PACKAGE',
                        taskType: 'WORK_PACKAGE',
                        parentId: boqRoot.id,
                        requiredJobRole: 'CONTRACTOR_SUPERVISOR',
                        enabled: true,
                        isRequired: true,
                        sortOrder: 900000 + index,
                        plannedDurationDays: 1,
                        assignedContractorId: boq.contractorId,
                    },
                });
            }
        });
        return this.getPlan(project.id);
    }

    static async addTemplate(projectId: string, actorId: string, sourceTemplateId: string) {
        await assertPlanDesigner(projectId, actorId);
        const plan = await this.initialize(projectId, actorId);
        if (!plan) throw AppError.internal('TASK_PLAN_INITIALIZATION_FAILED');
        await assertEditable(plan.id);
        const source = await db.workflowTaskTemplate.findUnique({
            where: { id: sourceTemplateId },
            include: { stageTemplate: { select: { code: true, sequence: true, workflowTemplate: { select: { projectTypeId: true } } } } },
        });
        const project = await getProject(projectId);
        if (!source || source.stageTemplate.workflowTemplate.projectTypeId !== project.projectTypeId || !source.isSupervisorSelectable) {
            throw AppError.badRequest('TASK_TEMPLATE_NOT_AVAILABLE_FOR_PROJECT');
        }
        const prefix = source.stageTemplate.code || `STAGE_${source.stageTemplate.sequence}`;
        const code = `${prefix}_${source.code || source.id.slice(0, 8)}`;
        const existing = await db.projectTaskPlanItem.findFirst({ where: { planId: plan.id, sourceTemplateId }, select: { id: true } });
        if (existing) throw AppError.conflict('TASK_TEMPLATE_ALREADY_ADDED');
        await db.projectTaskPlanItem.create({
            data: { planId: plan.id, sourceTemplateId, code, name: source.name, description: source.description, sourceType: 'TEMPLATE', taskType: source.taskType, requiredJobRole: source.assignmentRole, assignmentTeamKey: source.assignmentTeamKey, isRequired: source.isRequired, plannedDurationDays: source.defaultDurationDays, sortOrder: 500000 },
        });
        return this.getPlan(projectId);
    }

    static async updateItem(projectId: string, actorId: string, itemId: string, input: Record<string, unknown>) {
        await assertPlanDesigner(projectId, actorId);
        const plan = await this.initialize(projectId, actorId);
        if (!plan) throw AppError.internal('TASK_PLAN_INITIALIZATION_FAILED');
        await assertEditable(plan.id);
        const item = await db.projectTaskPlanItem.findFirst({ where: { id: itemId, planId: plan.id }, select: { id: true, requiredJobRole: true, parentId: true } });
        if (!item) throw AppError.notFound('TASK_PLAN_ITEM_NOT_FOUND');

        const assignedUserId = input.assignedUserId === undefined ? undefined : asOptionalString(input.assignedUserId);
        const assignedContractorId = input.assignedContractorId === undefined ? undefined : asOptionalString(input.assignedContractorId);
        if (assignedUserId !== undefined) await assertAssignedUser(projectId, assignedUserId, item.requiredJobRole);
        if (assignedContractorId !== undefined) await assertAssignedContractor(projectId, assignedContractorId);
        if (input.parentId !== undefined && input.parentId !== null) {
            const parent = await db.projectTaskPlanItem.findFirst({ where: { id: String(input.parentId), planId: plan.id }, select: { id: true } });
            if (!parent || parent.id === item.id) throw AppError.badRequest('INVALID_TASK_PLAN_PARENT');
        }

        const data: Prisma.ProjectTaskPlanItemUpdateInput = {};
        if (input.name !== undefined) data.name = String(input.name).trim();
        if (input.description !== undefined) data.description = asOptionalString(input.description);
        if (input.enabled !== undefined) data.enabled = Boolean(input.enabled);
        if (input.sortOrder !== undefined) data.sortOrder = Number(input.sortOrder);
        if (input.parentId !== undefined) data.parent = input.parentId ? { connect: { id: String(input.parentId) } } : { disconnect: true };
        if (assignedUserId !== undefined) data.assignedUser = assignedUserId ? { connect: { id: assignedUserId } } : { disconnect: true };
        if (assignedContractorId !== undefined) data.assignedContractor = assignedContractorId ? { connect: { id: assignedContractorId } } : { disconnect: true };
        if (input.plannedStart !== undefined) data.plannedStart = asOptionalDate(input.plannedStart);
        if (input.plannedFinish !== undefined) data.plannedFinish = asOptionalDate(input.plannedFinish);
        if (input.plannedDurationDays !== undefined) data.plannedDurationDays = input.plannedDurationDays === null ? null : Number(input.plannedDurationDays);
        await db.projectTaskPlanItem.update({ where: { id: item.id }, data });
        return this.getPlan(projectId);
    }

    static async removeItem(projectId: string, actorId: string, itemId: string) {
        await assertPlanDesigner(projectId, actorId);
        const plan = await this.initialize(projectId, actorId);
        if (!plan) throw AppError.internal('TASK_PLAN_INITIALIZATION_FAILED');
        await assertEditable(plan.id);
        const item = await db.projectTaskPlanItem.findFirst({ where: { id: itemId, planId: plan.id }, include: { children: { select: { id: true } }, projectTask: { select: { id: true } } } });
        if (!item) throw AppError.notFound('TASK_PLAN_ITEM_NOT_FOUND');
        if (item.isRequired) throw AppError.badRequest('REQUIRED_TASK_CANNOT_BE_REMOVED');
        if (item.children.length > 0) throw AppError.badRequest('REMOVE_CHILD_TASKS_FIRST');
        if (item.projectTask) throw AppError.conflict('GENERATED_TASK_CANNOT_BE_REMOVED_FROM_LOCKED_PLAN');
        await db.projectTaskPlanItem.delete({ where: { id: item.id } });
        return this.getPlan(projectId);
    }

    static async reorder(projectId: string, actorId: string, orderedItemIds: string[]) {
        await assertPlanDesigner(projectId, actorId);
        const plan = await this.initialize(projectId, actorId);
        if (!plan) throw AppError.internal('TASK_PLAN_INITIALIZATION_FAILED');
        await assertEditable(plan.id);
        const items = await db.projectTaskPlanItem.findMany({ where: { planId: plan.id }, select: { id: true } });
        const validIds = new Set(items.map(item => item.id));
        if (orderedItemIds.length !== items.length || orderedItemIds.some(id => !validIds.has(id))) throw AppError.badRequest('TASK_PLAN_ORDER_MISMATCH');
        await db.$transaction(orderedItemIds.map((id, index) => db.projectTaskPlanItem.update({ where: { id }, data: { sortOrder: index } })));
        return this.getPlan(projectId);
    }

    static async finalize(projectId: string, actorId: string) {
        await assertPlanDesigner(projectId, actorId);
        const project = await getProject(projectId);
        const plan = await db.projectTaskPlan.findUnique({ where: { projectId }, include: { items: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] } } });
        if (!plan) throw AppError.badRequest('TASK_PLAN_NOT_INITIALIZED');
        if (!EDITABLE_PLAN_STATUSES.has(plan.status)) return this.getPlan(projectId);
        const approvedBoq = await db.bOQApproval.findFirst({ where: { projectId, status: 'APPROVED' }, select: { id: true } });
        if (!approvedBoq) throw AppError.badRequest('BOQ_APPROVAL_REQUIRED_FOR_TASK_PLAN');
        if (plan.configuredById === actorId) throw AppError.conflict('TASK_PLAN_SELF_APPROVAL_NOT_ALLOWED');
        const enabled = plan.items.filter(item => item.enabled);
        const disabledRequired = plan.items.filter(item => !item.enabled && item.isRequired);
        if (disabledRequired.length) throw AppError.badRequest(`REQUIRED_TASKS_DISABLED:${disabledRequired.map(item => item.name).join(', ')}`);
        const parentIds = new Set(enabled.map(item => item.parentId).filter((id): id is string => Boolean(id)));
        const missingAssignments = enabled.filter(item => !parentIds.has(item.id) && !item.assignedUserId && !item.assignedContractorId);
        if (missingAssignments.length) throw AppError.badRequest(`TASK_ASSIGNMENTS_REQUIRED:${missingAssignments.map(item => item.name).join(', ')}`);

        const byId = new Map(plan.items.map(item => [item.id, item]));
        for (const item of enabled) {
            if (item.parentId && (!byId.get(item.parentId)?.enabled)) throw AppError.badRequest(`TASK_PARENT_DISABLED:${item.name}`);
        }

        await db.$transaction(async tx => {
            const taskIdByPlanItem = new Map<string, string>();
            const wbsByPlanItem = new Map<string, string>();
            const siblingCounters = new Map<string, number>();
            // A project may be created before dates are entered in the plan
            // designer. Give generated tasks a deterministic planning window
            // instead of surfacing an opaque INVALID_TASK_DATE_RANGE 500.
            const projectStart = project.startDate || new Date();
            const projectEnd = project.endDate || addDays(projectStart, 365);
            let cursor = projectStart;
            const depthOf = (item: typeof enabled[number]) => {
                let depth = 0;
                let parentId = item.parentId;
                const seen = new Set<string>();
                while (parentId) {
                    if (seen.has(parentId)) throw AppError.badRequest('TASK_PLAN_PARENT_CYCLE');
                    seen.add(parentId);
                    const parent = byId.get(parentId);
                    if (!parent) break;
                    depth += 1;
                    parentId = parent.parentId;
                }
                return depth;
            };
            const orderedEnabled = [...enabled].sort((left, right) => depthOf(left) - depthOf(right) || left.sortOrder - right.sortOrder);
            for (const item of orderedEnabled) {
                const parentTaskId = item.parentId ? taskIdByPlanItem.get(item.parentId) || null : null;
                const duration = Math.max(1, item.plannedDurationDays || 1);
                const schedule = normalizeTaskSchedule({
                    projectStartDate: projectStart,
                    projectEndDate: projectEnd,
                    plannedStartDate: item.plannedStart || cursor,
                    plannedEndDate: item.plannedFinish || null,
                    plannedDuration: duration,
                });
                const siblingKey = item.parentId || 'ROOT';
                const siblingIndex = (siblingCounters.get(siblingKey) || 0) + 1;
                siblingCounters.set(siblingKey, siblingIndex);
                const parentWbsCode = item.parentId ? wbsByPlanItem.get(item.parentId) : null;
                const wbsCode = parentWbsCode ? `${parentWbsCode}.${siblingIndex}` : `${siblingIndex}`;
                const taskData = {
                    projectId,
                    parentId: parentTaskId,
                    wbsCode,
                    name: item.name,
                    description: item.description,
                    type: item.taskType,
                    status: 'PENDING',
                    priority: 'MEDIUM',
                    plannedStartDate: schedule.plannedStartDate,
                    plannedEndDate: schedule.plannedEndDate,
                    plannedDuration: schedule.plannedDuration,
                    order: item.sortOrder,
                    assigneeType: item.assignedUserId ? 'USER' : item.assignedContractorId ? 'CONTRACTOR' : null,
                    assigneeId: item.assignedUserId || item.assignedContractorId || null,
                    assignedUserId: item.assignedUserId,
                    contractorId: item.assignedContractorId,
                    actualProgress: 0,
                    planItemId: item.id,
                };
                const existing = await tx.projectTask.findUnique({ where: { planItemId: item.id }, select: { id: true } });
                const task = existing
                    ? await tx.projectTask.update({ where: { id: existing.id }, data: taskData, select: { id: true } })
                    : await tx.projectTask.create({ data: taskData, select: { id: true } });
                taskIdByPlanItem.set(item.id, task.id);
                wbsByPlanItem.set(item.id, wbsCode);
                if (item.sourceBoqItemId) await tx.projectBOQItem.update({ where: { id: item.sourceBoqItemId }, data: { taskId: task.id } });
                cursor = addDays(schedule.plannedEndDate || cursor, 1);
            }
            await tx.projectTaskPlan.update({ where: { id: plan.id }, data: { status: 'APPROVED', version: { increment: 1 }, approvedById: actorId, approvedAt: new Date(), generatedAt: new Date() } });
        });
        return this.getPlan(projectId);
    }
}
