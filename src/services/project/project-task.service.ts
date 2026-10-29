import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { dependencyDateConflict, normalizeTaskSchedule } from '@/lib/project-schedule';
import { Prisma } from '@prisma/client';
import { assertProjectAccess } from '@/lib/project-access';

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export interface CreateTaskInput {
    projectId: string;
    parentId?: string | null;
    wbsCode?: string;
    name: string;
    description?: string;
    type?: string;
    plannedStartDate?: string | Date | null;
    plannedEndDate?: string | Date | null;
    plannedDuration?: string | number | null;
    priority?: string;
    estimatedCost?: string | number | null;
    order?: number;
    assigneeType?: string;
    assigneeId?: string;
    contractorId?: string | null;
    contractorAssignmentId?: string | null;
}

export interface UpdateTaskInput {
    parentId?: string | null;
    wbsCode?: string;
    name?: string;
    description?: string;
    type?: string;
    priority?: string;
    plannedStartDate?: string | Date | null;
    plannedEndDate?: string | Date | null;
    plannedDuration?: string | number | null;
    actualStartDate?: string | Date | null;
    actualEndDate?: string | Date | null;
    estimatedCost?: string | number | null;
    order?: number;
    assigneeType?: string;
    assigneeId?: string;
    contractorId?: string | null;
    contractorAssignmentId?: string | null;
    status?: string;
    actualProgress?: number;
}

interface CreateDependencyInput {
    taskId: string;
    dependsOnTaskId: string;
    type?: string;
    lagDays?: number;
}

interface LogProgressInput {
    taskId: string;
    progress: string | number;
    description?: string | null;
    photoUrls?: string[];
    gpsLatitude?: string | number | null;
    gpsLongitude?: string | number | null;
    loggedById?: string | null;
}

async function getActiveProjectContractorAssignment(
    projectId: string,
    contractorId: string,
    db: typeof prisma | TransactionClient = prisma,
) {
    const assignment = await db.projectContractorAssignment.findUnique({
        where: { projectId_contractorId: { projectId, contractorId } },
        select: { id: true, contractorId: true, status: true },
    });
    if (!assignment || assignment.status !== 'ACTIVE') {
        throw AppError.badRequest('CONTRACTOR_MUST_BE_ASSIGNED_TO_PROJECT');
    }
    return assignment;
}

async function getAssignmentForTask(
    projectId: string,
    contractorAssignmentId: string,
    db: typeof prisma | TransactionClient = prisma,
) {
    const assignment = await db.projectContractorAssignment.findUnique({
        where: { id: contractorAssignmentId },
        select: { id: true, projectId: true, contractorId: true, status: true },
    });
    if (!assignment || assignment.projectId !== projectId || assignment.status !== 'ACTIVE') {
        throw AppError.badRequest('CONTRACTOR_ASSIGNMENT_NOT_FOUND');
    }
    return assignment;
}

async function assertApprovedBoq(projectId: string, db: typeof prisma | TransactionClient = prisma) {
    const approval = await db.bOQApproval.findFirst({
        where: { projectId, status: 'APPROVED' },
        select: { id: true },
    });
    if (!approval) throw AppError.badRequest('BOQ_APPROVAL_REQUIRED_FOR_CHILD_TASKS');
}

const TASK_PLAN_MANAGERS = new Set(['SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'MANAGER', 'OSP_MANAGER', 'AREA_MANAGER', 'ENGINEER', 'ASSISTANT_ENGINEER']);
const PROGRESS_FIELDS = new Set(['status', 'actualProgress', 'actualStartDate', 'actualEndDate']);

async function assertTaskActor(taskId: string, projectId: string | undefined, actorId: string | null | undefined, mode: 'PROGRESS' | 'FULL') {
    if (!actorId) throw AppError.unauthorized('Authenticated task user required');
    const [task, actor] = await Promise.all([
        prisma.projectTask.findUnique({ where: { id: taskId }, select: { projectId: true, assignedUserId: true, planItem: { select: { assignedUserId: true } } } }),
        prisma.user.findUnique({ where: { id: actorId }, select: { id: true, role: true, status: true } }),
    ]);
    if (!task) throw AppError.notFound('Task not found');
    if (projectId && task.projectId !== projectId) throw AppError.forbidden('Task does not belong to this project');
    if (!actor || actor.status !== 'active') throw AppError.unauthorized('Authenticated task user is not active');

    const supervisorAssignment = await prisma.projectSupervisorAssignment.findFirst({ where: { projectId: task.projectId, supervisorId: actorId, status: 'ASSIGNED' }, select: { id: true } });
    const isManager = TASK_PLAN_MANAGERS.has(actor.role);
    const isAssigned = task.assignedUserId === actorId || task.planItem?.assignedUserId === actorId;
    if (!isManager && !supervisorAssignment && !isAssigned) throw AppError.forbidden('Task is not assigned to this user');
    if (mode === 'FULL' && !isManager && !supervisorAssignment) throw AppError.forbidden('Only the project supervisor or project management can edit task configuration');
    return { task, actor };
}

async function updateParentProgress(parentId: string, tx: TransactionClient) {
    const parent = await tx.projectTask.findUnique({
        where: { id: parentId },
        include: { children: { select: { actualProgress: true } } }
    });
    if (!parent) return;

    const children = parent.children;
    if (children.length > 0) {
        const avgProgress = children.reduce((sum: number, c: { actualProgress: unknown }) => sum + Number(c.actualProgress || 0), 0) / children.length;
        const newProgress = Math.round(avgProgress);
        
        await tx.projectTask.update({
            where: { id: parentId },
            data: { 
                actualProgress: newProgress,
                status: newProgress >= 100 ? 'COMPLETED' : newProgress > 0 ? 'IN_PROGRESS' : 'PENDING'
            }
        });
    }

    if (parent.parentId) {
        await updateParentProgress(parent.parentId, tx);
    }
}

export class ProjectTaskService {
    /**
     * Get all tasks for a project
     */
    static async getTasks(projectId: string, parentId?: string | null, viewerId?: string | null, viewerRole?: string | null) {
        await assertProjectAccess(projectId, viewerId);
        const where: Prisma.ProjectTaskWhereInput = { projectId };
        if (parentId === 'null') {
            where.parentId = null;
        } else if (parentId) {
            where.parentId = parentId;
        }

        if (viewerId && viewerRole && !TASK_PLAN_MANAGERS.has(viewerRole)) {
            const supervisorAssignment = await prisma.projectSupervisorAssignment.findFirst({ where: { projectId, supervisorId: viewerId, status: 'ASSIGNED' }, select: { id: true } });
            if (!supervisorAssignment) {
                where.AND = [{ OR: [{ assignedUserId: viewerId }, { planItem: { assignedUserId: viewerId } }, { planItem: { requiredJobRole: viewerRole } }] }];
            }
        }

        const tasks = await prisma.projectTask.findMany({
            where,
            include: {
                children: { select: { id: true, name: true, status: true, actualProgress: true } },
                contractor: { select: { id: true, name: true } },
                contractorAssignment: { select: { id: true, status: true, contractorId: true } },
                dependencies: {
                    include: { dependsOn: { select: { id: true, name: true, status: true, wbsCode: true } } }
                },
                progressLogs: { orderBy: { date: 'desc' }, take: 5 },
                _count: { select: { children: true, timesheets: true } }
            },
            orderBy: { order: 'asc' }
        });

        return tasks;
    }

    /**
     * Create a task
     */
    static async createTask(data: CreateTaskInput, actorId?: string | null) {
        const { projectId, parentId, wbsCode, name, description, type, plannedStartDate, plannedEndDate, plannedDuration, priority, estimatedCost, order, assigneeType, assigneeId, contractorId, contractorAssignmentId } = data;

        await assertProjectAccess(projectId, actorId);

        const optionalString = (value?: string | null) => {
            const normalized = value?.trim();
            return normalized || null;
        };

        const task = await prisma.$transaction(async (tx) => {
            const project = await tx.project.findUnique({
                where: { id: projectId },
                select: { id: true, startDate: true, endDate: true },
            });
            if (!project) throw AppError.notFound('Project not found');

            let normalizedSchedule;
            try {
                normalizedSchedule = normalizeTaskSchedule({
                    projectStartDate: project.startDate,
                    projectEndDate: project.endDate,
                    plannedStartDate,
                    plannedEndDate,
                    plannedDuration,
                });
            } catch (error: unknown) {
                if (error instanceof Error) throw AppError.badRequest(error.message);
                throw error;
            }

            const parent = parentId
                ? await tx.projectTask.findUnique({ where: { id: parentId } })
                : null;

            if (parentId && !parent) {
                throw AppError.notFound('Parent task was not found');
            }
            if (parent && parent.projectId !== projectId) {
                throw AppError.badRequest('Parent task must belong to the same project');
            }
            if (parentId) await assertApprovedBoq(projectId, tx);

            let resolvedContractorId = contractorId || null;
            let resolvedContractorAssignmentId = contractorAssignmentId || null;
            if (contractorAssignmentId) {
                const assignment = await getAssignmentForTask(projectId, contractorAssignmentId, tx);
                resolvedContractorId = assignment.contractorId;
            }
            if (assigneeType === 'CONTRACTOR' && assigneeId) {
                const assignment = await getActiveProjectContractorAssignment(projectId, assigneeId, tx);
                resolvedContractorId = assigneeId;
                resolvedContractorAssignmentId = assignment.id;
            } else if (resolvedContractorId) {
                const assignment = await getActiveProjectContractorAssignment(projectId, resolvedContractorId, tx);
                resolvedContractorAssignmentId = assignment.id;
            }

            // The WBS field is optional in the UI. Generate a stable code for
            // both root and child tasks when the user leaves it blank.
            let finalWbsCode = optionalString(wbsCode);
            if (!finalWbsCode) {
                const siblingCount = await tx.projectTask.count({
                    where: parentId ? { parentId } : { projectId, parentId: null }
                });
                finalWbsCode = parent
                    ? `${parent.wbsCode || siblingCount + 1}.${siblingCount + 1}`
                    : `${siblingCount + 1}`;
            }

            return tx.projectTask.create({
                data: {
                    projectId,
                    parentId: parentId || null,
                    wbsCode: finalWbsCode,
                    name: name.trim(),
                    description: optionalString(description),
                    type: optionalString(type) || 'TASK',
                    priority: optionalString(priority) || 'MEDIUM',
                    plannedStartDate: normalizedSchedule.plannedStartDate,
                    plannedEndDate: normalizedSchedule.plannedEndDate,
                    plannedDuration: normalizedSchedule.plannedDuration,
                    estimatedCost: estimatedCost !== null && estimatedCost !== undefined && String(estimatedCost).trim() !== '' ? parseFloat(String(estimatedCost)) : null,
                    order: order ?? 0,
                    assigneeType: optionalString(assigneeType),
                    assigneeId: optionalString(assigneeId),
                    contractorId: resolvedContractorId,
                    contractorAssignmentId: resolvedContractorAssignmentId,
                    status: 'PENDING',
                    actualProgress: 0
                },
                include: {
                    children: { select: { id: true, name: true, status: true } },
                    _count: { select: { children: true } }
                }
            });
        });

        return task;
    }

    /**
     * Update a task
     */
    static async updateTask(id: string, updateData: UpdateTaskInput, projectId?: string, actorId?: string | null) {
        const mode = Object.keys(updateData).every(key => PROGRESS_FIELDS.has(key)) ? 'PROGRESS' : 'FULL';
        await assertTaskActor(id, projectId, actorId, mode);
        const data: Record<string, unknown> = { ...updateData };

        const currentTask = await prisma.projectTask.findUnique({
            where: { id },
            select: {
                projectId: true,
                parentId: true,
                plannedStartDate: true,
                plannedEndDate: true,
                plannedDuration: true,
                actualStartDate: true,
                actualEndDate: true,
                status: true,
            },
        });
        if (!currentTask) throw AppError.notFound('Task not found');
        if (projectId && currentTask.projectId !== projectId) throw AppError.forbidden('Task does not belong to this project');

        const taskProjectId = currentTask.projectId;
        const project = await prisma.project.findUnique({
            where: { id: taskProjectId },
            select: { startDate: true, endDate: true },
        });
        if (!project) throw AppError.notFound('Project not found');

        let normalizedSchedule;
        try {
            normalizedSchedule = normalizeTaskSchedule({
                projectStartDate: project.startDate,
                projectEndDate: project.endDate,
                plannedStartDate: updateData.plannedStartDate !== undefined ? updateData.plannedStartDate : currentTask.plannedStartDate,
                plannedEndDate: updateData.plannedEndDate !== undefined ? updateData.plannedEndDate : currentTask.plannedEndDate,
                plannedDuration: updateData.plannedDuration !== undefined ? updateData.plannedDuration : currentTask.plannedDuration,
            });
        } catch (error: unknown) {
            if (error instanceof Error) throw AppError.badRequest(error.message);
            throw error;
        }

        const dependencies = await prisma.taskDependency.findMany({
            where: { taskId: id },
            select: {
                type: true,
                lagDays: true,
                dependsOn: { select: { plannedStartDate: true, plannedEndDate: true } },
            },
        });
        if (dependencies.some((dependency) => dependencyDateConflict(
            dependency.type,
            dependency.lagDays,
            normalizedSchedule,
            dependency.dependsOn,
        ))) {
            throw AppError.conflict('TASK_DEPENDENCY_DATE_CONFLICT');
        }

        data.plannedStartDate = normalizedSchedule.plannedStartDate;
        data.plannedEndDate = normalizedSchedule.plannedEndDate;
        data.plannedDuration = normalizedSchedule.plannedDuration;
        if (updateData.parentId !== undefined && updateData.parentId !== null) {
            if (updateData.parentId === id) throw AppError.badRequest('SELF_PARENT_TASK');
            const parent = await prisma.projectTask.findUnique({ where: { id: updateData.parentId }, select: { projectId: true } });
            if (!parent || parent.projectId !== taskProjectId) throw AppError.badRequest('PARENT_TASK_PROJECT_MISMATCH');
            await assertApprovedBoq(taskProjectId);
        }
        if (currentTask.parentId && (updateData.contractorId !== undefined || updateData.contractorAssignmentId !== undefined || updateData.assigneeType === 'CONTRACTOR')) {
            await assertApprovedBoq(taskProjectId);
        }

        const nextStatus = String(updateData.status || currentTask.status || 'PENDING').toUpperCase();
        if (!['PENDING', 'IN_PROGRESS', 'COMPLETED', 'DELAYED'].includes(nextStatus)) {
            throw AppError.badRequest('INVALID_TASK_STATUS');
        }
        if (nextStatus === 'IN_PROGRESS' || nextStatus === 'COMPLETED') {
            const prerequisites = await prisma.taskDependency.findMany({
                where: { taskId: id },
                select: { dependsOn: { select: { status: true } } },
            });
            if (prerequisites.some(({ dependsOn }) => String(dependsOn.status).toUpperCase() !== 'COMPLETED')) {
                throw AppError.conflict('TASK_DEPENDENCY_NOT_READY');
            }
        }

        if (updateData.actualStartDate !== undefined) data.actualStartDate = updateData.actualStartDate ? new Date(updateData.actualStartDate) : null;
        if (updateData.actualEndDate !== undefined) data.actualEndDate = updateData.actualEndDate ? new Date(updateData.actualEndDate) : null;

        if (nextStatus === 'IN_PROGRESS' && !currentTask.actualStartDate && updateData.actualStartDate === undefined) {
            data.actualStartDate = new Date();
        }
        if (nextStatus === 'COMPLETED' && !currentTask.actualEndDate && updateData.actualEndDate === undefined) {
            data.actualEndDate = new Date();
        }

        if (updateData.estimatedCost) data.estimatedCost = parseFloat(String(updateData.estimatedCost));

        if (updateData.assigneeType === 'CONTRACTOR' && updateData.assigneeId) {
            const assignment = await getActiveProjectContractorAssignment(taskProjectId, updateData.assigneeId);
            data.contractorId = updateData.assigneeId;
            data.contractorAssignmentId = assignment.id;
        } else if (updateData.contractorAssignmentId) {
            const assignment = await getAssignmentForTask(taskProjectId, updateData.contractorAssignmentId);
            data.contractorId = assignment.contractorId;
        } else if (updateData.contractorId) {
            const assignment = await getActiveProjectContractorAssignment(taskProjectId, updateData.contractorId);
            data.contractorAssignmentId = assignment.id;
        } else if (updateData.contractorId === null || updateData.contractorAssignmentId === null) {
            data.contractorId = null;
            data.contractorAssignmentId = null;
        } else if (updateData.assigneeType && updateData.assigneeType !== 'CONTRACTOR') {
            data.contractorId = null;
            data.contractorAssignmentId = null;
        }

        const task = await prisma.projectTask.update({
            where: { id },
            data,
            include: {
                children: { select: { id: true, name: true, status: true } },
                dependencies: {
                    include: { dependsOn: { select: { id: true, name: true, status: true } } }
                }
            }
        });

        return task;
    }

    /**
     * Delete a task
     */
    static async deleteTask(id: string, projectId?: string, actorId?: string | null) {
        await assertTaskActor(id, projectId, actorId, 'FULL');
        const task = await prisma.projectTask.findUnique({ where: { id }, select: { projectId: true } });
        if (!task) throw AppError.notFound('Task not found');
        if (projectId && task.projectId !== projectId) throw AppError.forbidden('Task does not belong to this project');
        // Check if task has children
        const childCount = await prisma.projectTask.count({ where: { parentId: id } });
        if (childCount > 0) {
            throw AppError.badRequest('HAS_SUB_TASKS');
        }

        await prisma.projectTask.delete({ where: { id } });
        return { success: true };
    }

    /**
     * Get all task dependencies
     */
    static async getTaskProjectId(taskId: string) {
        const task = await prisma.projectTask.findUnique({ where: { id: taskId }, select: { projectId: true } });
        if (!task) throw AppError.notFound('Task not found');
        return task;
    }

    static async getDependencyProjectId(id: string) {
        const dependency = await prisma.taskDependency.findUnique({
            where: { id },
            select: { task: { select: { projectId: true } } },
        });
        if (!dependency) throw AppError.notFound('Dependency not found');
        return dependency.task;
    }

    static async getDependencies(taskId: string, actorId?: string | null) {
        const task = await this.getTaskProjectId(taskId);
        await assertProjectAccess(task.projectId, actorId);
        const where: Record<string, unknown> = { taskId };

        const dependencies = await prisma.taskDependency.findMany({
            where,
            include: {
                task: { select: { id: true, name: true, wbsCode: true, status: true } },
                dependsOn: { select: { id: true, name: true, wbsCode: true, status: true } }
            }
        });

        return dependencies;
    }

    /**
     * Create a task dependency
     */
    static async createDependency(data: CreateDependencyInput, actorId?: string | null) {
        const { taskId, dependsOnTaskId, type, lagDays } = data;

        if (taskId === dependsOnTaskId) {
            throw AppError.badRequest('SELF_DEPENDENCY');
        }

        const [task, prerequisite] = await Promise.all([
            prisma.projectTask.findUnique({ where: { id: taskId }, select: { id: true, projectId: true, plannedStartDate: true, plannedEndDate: true } }),
            prisma.projectTask.findUnique({ where: { id: dependsOnTaskId }, select: { id: true, projectId: true, plannedStartDate: true, plannedEndDate: true } }),
        ]);
        if (!task || !prerequisite) throw AppError.notFound('DEPENDENCY_TASK_NOT_FOUND');
        if (task.projectId !== prerequisite.projectId) throw AppError.badRequest('CROSS_PROJECT_DEPENDENCY');
        await assertProjectAccess(task.projectId, actorId);

        const dependencyType = type || 'FINISH_TO_START';
        const dependencyLagDays = lagDays || 0;
        if (!['FINISH_TO_START', 'START_TO_START', 'FINISH_TO_FINISH', 'START_TO_FINISH'].includes(dependencyType)) {
            throw AppError.badRequest('INVALID_DEPENDENCY_TYPE');
        }
        if (!Number.isInteger(dependencyLagDays) || dependencyLagDays < 0) {
            throw AppError.badRequest('INVALID_DEPENDENCY_LAG');
        }
        if (dependencyDateConflict(dependencyType, dependencyLagDays, task, prerequisite)) {
            throw AppError.conflict('TASK_DEPENDENCY_DATE_CONFLICT');
        }

        // Check for circular dependency
        const existing = await prisma.taskDependency.findUnique({
            where: { taskId_dependsOnTaskId: { taskId, dependsOnTaskId } }
        });
        if (existing) {
            throw AppError.badRequest('DEPENDENCY_EXISTS');
        }

        const visited = new Set<string>();
        let frontier = [dependsOnTaskId];
        while (frontier.length > 0) {
            const edges = await prisma.taskDependency.findMany({
                where: { taskId: { in: frontier } },
                select: { dependsOnTaskId: true },
            });
            const next: string[] = [];
            for (const edge of edges) {
                if (edge.dependsOnTaskId === taskId) throw AppError.badRequest('CIRCULAR_DEPENDENCY');
                if (!visited.has(edge.dependsOnTaskId)) {
                    visited.add(edge.dependsOnTaskId);
                    next.push(edge.dependsOnTaskId);
                }
            }
            frontier = next;
        }

        const dependency = await prisma.taskDependency.create({
            data: {
                taskId,
                dependsOnTaskId,
                type: dependencyType,
                lagDays: dependencyLagDays
            },
            include: {
                task: { select: { id: true, name: true, wbsCode: true } },
                dependsOn: { select: { id: true, name: true, wbsCode: true } }
            }
        });

        return dependency;
    }

    /**
     * Delete a task dependency
     */
    static async deleteDependency(id: string) {
        await prisma.taskDependency.delete({ where: { id } });
        return { success: true };
    }

    /**
     * Get progress logs for a task
     */
    static async getProgressLogs(taskId: string, actorId?: string | null) {
        const task = await this.getTaskProjectId(taskId);
        await assertProjectAccess(task.projectId, actorId);
        const logs = await prisma.taskProgressLog.findMany({
            where: { taskId },
            orderBy: { date: 'desc' }
        });
        return logs;
    }

    /**
     * Log progress update for a task
     */
    static async logProgress(data: LogProgressInput & { projectId?: string }) {
        const { taskId, progress, description, photoUrls, gpsLatitude, gpsLongitude, loggedById, projectId } = data;

        const task = await prisma.projectTask.findUnique({
            where: { id: taskId },
            select: { projectId: true, actualStartDate: true, actualEndDate: true },
        });
        if (!task) throw AppError.notFound('Task not found');
        if (projectId && task.projectId !== projectId) throw AppError.forbidden('Task does not belong to this project');
        await assertProjectAccess(task.projectId, loggedById);
        await assertTaskActor(taskId, projectId, loggedById, 'PROGRESS');

        const progressVal = parseInt(String(progress), 10);
        if (isNaN(progressVal) || progressVal < 0 || progressVal > 100) {
            throw AppError.badRequest('INVALID_PROGRESS_RANGE');
        }
        if (progressVal > 0) {
            const prerequisites = await prisma.taskDependency.findMany({
                where: { taskId },
                select: { dependsOn: { select: { status: true } } },
            });
            if (prerequisites.some(({ dependsOn }) => String(dependsOn.status).toUpperCase() !== 'COMPLETED')) {
                throw AppError.conflict('TASK_DEPENDENCY_NOT_READY');
            }
        }

        const log = await prisma.$transaction(async (tx) => {
            // Create progress log
            const newLog = await tx.taskProgressLog.create({
                data: {
                    taskId,
                    progress: progressVal,
                    description: description || null,
                    photoUrls: photoUrls || [],
                    gpsLatitude: gpsLatitude ? parseFloat(String(gpsLatitude)) : null,
                    gpsLongitude: gpsLongitude ? parseFloat(String(gpsLongitude)) : null,
                    loggedById: loggedById || null
                }
            });

            // Update the task's actual progress
            await tx.projectTask.update({
                where: { id: taskId },
                data: {
                    actualProgress: progressVal,
                    status: progressVal >= 100 ? 'COMPLETED' : progressVal > 0 ? 'IN_PROGRESS' : 'PENDING',
                    actualStartDate: progressVal > 0 ? (task.actualStartDate || new Date()) : undefined,
                    actualEndDate: progressVal >= 100 ? (task.actualEndDate || new Date()) : undefined
                }
            });

            // Fetch task to check for parent WBS level
            const parentTask = await tx.projectTask.findUnique({
                where: { id: taskId },
                select: { parentId: true }
            });

            // Recursively update parents
            if (parentTask?.parentId) {
                await updateParentProgress(parentTask.parentId, tx);
            }

            return newLog;
        });

        return log;
    }

    /**
     * Add a field photo for a task
     */
    static async addFieldPhoto(projectId: string, taskId: string, data: { fileName: string; fileUrl: string; photoType: string; latitude?: number; longitude?: number }) {
        const { fileName, fileUrl, photoType, latitude, longitude } = data;

        // Verify the project exists
        const project = await prisma.project.findUnique({
            where: { id: projectId }
        });

        if (!project) {
            throw AppError.badRequest('PROJECT_NOT_FOUND');
        }

        // Verify the field task exists and belongs to the project
        const fieldTask = await prisma.fieldTask.findUnique({
            where: { id: taskId }
        });

        if (!fieldTask) {
            throw AppError.badRequest('TASK_NOT_FOUND');
        }

        if (fieldTask.projectId !== projectId) {
            throw AppError.badRequest('TASK_PROJECT_MISMATCH');
        }

        // Create the field photo record
        const photo = await prisma.fieldPhoto.create({
            data: {
                fieldTaskId: taskId,
                fileName,
                fileUrl,
                photoType,
                latitude: latitude ?? null,
                longitude: longitude ?? null,
            }
        });

        return photo;
    }
}
