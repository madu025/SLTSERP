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
}

interface UpdateTaskInput {
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

async function updateParentProgress(parentId: string, tx: TransactionClient) {
    const parent = await tx.projectTask.findUnique({
        where: { id: parentId },
        include: { children: { select: { actualProgress: true } } }
    });
    if (!parent) return;

    const children = parent.children;
    if (children.length > 0) {
        const avgProgress = children.reduce((sum: number, c: { actualProgress: number }) => sum + c.actualProgress, 0) / children.length;
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
        const { projectId, parentId, wbsCode, name, description, type, plannedStartDate, plannedEndDate, plannedDuration, priority, estimatedCost, order, assigneeType, assigneeId } = data;

        // Auto-generate WBS code if not provided for child tasks
        let finalWbsCode = wbsCode || '';
        if (parentId && !wbsCode) {
            const parent = await prisma.projectTask.findUnique({ where: { id: parentId } });
            if (parent) {
                const siblingCount = await prisma.projectTask.count({ where: { parentId } });
                finalWbsCode = `${parent.wbsCode}.${siblingCount + 1}`;
            }
        }

        const task = await prisma.projectTask.create({
            data: {
                projectId,
                parentId: parentId || null,
                wbsCode: finalWbsCode,
                name,
                description,
                type: type || 'TASK',
                priority: priority || 'MEDIUM',
                plannedStartDate: plannedStartDate ? new Date(plannedStartDate) : null,
                plannedEndDate: plannedEndDate ? new Date(plannedEndDate) : null,
                plannedDuration: plannedDuration ? parseInt(String(plannedDuration), 10) : null,
                estimatedCost: estimatedCost ? parseFloat(String(estimatedCost)) : null,
                order: order || 0,
                assigneeType,
                assigneeId,
                status: 'PENDING',
                actualProgress: 0
            },
            include: {
                children: { select: { id: true, name: true, status: true } },
                _count: { select: { children: true } }
            }
        });

        return task;
    }

    /**
     * Update a task
     */
    static async updateTask(id: string, updateData: UpdateTaskInput) {
        const data: Record<string, unknown> = { ...updateData };

        if (updateData.plannedStartDate) data.plannedStartDate = new Date(updateData.plannedStartDate);
        if (updateData.plannedEndDate) data.plannedEndDate = new Date(updateData.plannedEndDate);
        if (updateData.actualStartDate) data.actualStartDate = new Date(updateData.actualStartDate);
        if (updateData.actualEndDate) data.actualEndDate = new Date(updateData.actualEndDate);

        if (updateData.estimatedCost) data.estimatedCost = parseFloat(String(updateData.estimatedCost));

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
    static async deleteTask(id: string) {
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

        // Check for circular dependency
        const existing = await prisma.taskDependency.findUnique({
            where: { taskId_dependsOnTaskId: { taskId, dependsOnTaskId } }
        });
        if (existing) {
            throw AppError.badRequest('DEPENDENCY_EXISTS');
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
    static async logProgress(data: LogProgressInput) {
        const { taskId, progress, description, photoUrls, gpsLatitude, gpsLongitude, loggedById } = data;

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
