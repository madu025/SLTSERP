import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

interface CreateTaskInput {
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

interface UpdateTaskInput {
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
    static async getTasks(projectId: string, parentId?: string | null) {
        const where: Record<string, unknown> = { projectId };
        if (parentId === 'null') {
            where.parentId = null;
        } else if (parentId) {
            where.parentId = parentId;
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
    static async createTask(data: CreateTaskInput) {
        const { projectId, parentId, wbsCode, name, description, type, plannedStartDate, plannedEndDate, plannedDuration, priority, estimatedCost, order, assigneeType, assigneeId, contractorId, contractorAssignmentId } = data;

        const optionalString = (value?: string | null) => {
            const normalized = value?.trim();
            return normalized || null;
        };

        const task = await prisma.$transaction(async (tx) => {
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
                    plannedStartDate: plannedStartDate ? new Date(plannedStartDate) : null,
                    plannedEndDate: plannedEndDate ? new Date(plannedEndDate) : null,
                    plannedDuration: plannedDuration !== null && plannedDuration !== undefined && String(plannedDuration).trim() !== '' ? parseInt(String(plannedDuration), 10) : null,
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
    static async updateTask(id: string, updateData: UpdateTaskInput, projectId?: string) {
        const data: Record<string, unknown> = { ...updateData };

        const currentTask = await prisma.projectTask.findUnique({ where: { id }, select: { projectId: true, parentId: true } });
        if (!currentTask) throw AppError.notFound('Task not found');
        if (projectId && currentTask.projectId !== projectId) throw AppError.forbidden('Task does not belong to this project');

        const taskProjectId = currentTask.projectId;
        if (updateData.parentId !== undefined && updateData.parentId !== null) {
            if (updateData.parentId === id) throw AppError.badRequest('SELF_PARENT_TASK');
            const parent = await prisma.projectTask.findUnique({ where: { id: updateData.parentId }, select: { projectId: true } });
            if (!parent || parent.projectId !== taskProjectId) throw AppError.badRequest('PARENT_TASK_PROJECT_MISMATCH');
            await assertApprovedBoq(taskProjectId);
        }
        if (currentTask.parentId && (updateData.contractorId !== undefined || updateData.contractorAssignmentId !== undefined || updateData.assigneeType === 'CONTRACTOR')) {
            await assertApprovedBoq(taskProjectId);
        }

        if (updateData.plannedStartDate) data.plannedStartDate = new Date(updateData.plannedStartDate);
        if (updateData.plannedEndDate) data.plannedEndDate = new Date(updateData.plannedEndDate);
        if (updateData.actualStartDate) data.actualStartDate = new Date(updateData.actualStartDate);
        if (updateData.actualEndDate) data.actualEndDate = new Date(updateData.actualEndDate);

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
    static async deleteTask(id: string, projectId?: string) {
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
    static async getDependencies(taskId?: string | null) {
        const where: Record<string, unknown> = {};
        if (taskId) where.taskId = taskId;

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
    static async createDependency(data: CreateDependencyInput) {
        const { taskId, dependsOnTaskId, type, lagDays } = data;

        if (taskId === dependsOnTaskId) {
            throw AppError.badRequest('SELF_DEPENDENCY');
        }

        const [task, prerequisite] = await Promise.all([
            prisma.projectTask.findUnique({ where: { id: taskId }, select: { id: true, projectId: true } }),
            prisma.projectTask.findUnique({ where: { id: dependsOnTaskId }, select: { id: true, projectId: true } }),
        ]);
        if (!task || !prerequisite) throw AppError.notFound('DEPENDENCY_TASK_NOT_FOUND');
        if (task.projectId !== prerequisite.projectId) throw AppError.badRequest('CROSS_PROJECT_DEPENDENCY');

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
                type: type || 'FINISH_TO_START',
                lagDays: lagDays || 0
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
    static async getProgressLogs(taskId: string) {
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

        const task = await prisma.projectTask.findUnique({ where: { id: taskId }, select: { projectId: true } });
        if (!task) throw AppError.notFound('Task not found');
        if (projectId && task.projectId !== projectId) throw AppError.forbidden('Task does not belong to this project');

        const progressVal = parseInt(String(progress), 10);
        if (isNaN(progressVal) || progressVal < 0 || progressVal > 100) {
            throw AppError.badRequest('INVALID_PROGRESS_RANGE');
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
                    actualStartDate: progressVal > 0 ? new Date() : undefined,
                    actualEndDate: progressVal >= 100 ? new Date() : undefined
                }
            });

            // Fetch task to check for parent WBS level
            const task = await tx.projectTask.findUnique({
                where: { id: taskId },
                select: { parentId: true }
            });

            // Recursively update parents
            if (task?.parentId) {
                await updateParentProgress(task.parentId, tx);
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
