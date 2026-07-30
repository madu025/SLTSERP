import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';

export interface CreateFieldTaskInput {
    title: string;
    description?: string;
    status?: string;
    priority?: string;
    scheduledDate?: string | Date | null;
    latitude?: number | null;
    longitude?: number | null;
    address?: string | null;
    assignedUserId?: string | null;
}

export interface UpdateFieldTaskInput {
    title?: string;
    description?: string;
    status?: string;
    priority?: string;
    scheduledDate?: string | Date | null;
    startedAt?: string | Date | null;
    completedAt?: string | Date | null;
    durationMinutes?: number;
    latitude?: number | null;
    longitude?: number | null;
    address?: string | null;
    syncStatus?: string;
    deviceId?: string | null;
    appVersion?: string | null;
}

export interface SyncFieldTaskInput {
    id?: string;
    title: string;
    description?: string | null;
    status?: string;
    priority?: string;
    completedAt?: string | Date | null;
    latitude?: number | null;
    longitude?: number | null;
}
export class FieldTaskService {
    static async getFieldTasks(projectId: string) {
        return await prisma.fieldTask.findMany({
            where: { projectId },
            orderBy: { createdAt: 'desc' },
            include: {
                photos: true,
                checklists: true,
                signatures: true,
            },
        });
    }

    static async getFieldTask(projectId: string, taskId: string) {
        const fieldTask = await prisma.fieldTask.findUnique({
            where: { id: taskId },
            include: {
                photos: true,
                checklists: true,
                signatures: true,
            },
        });

        if (!fieldTask || fieldTask.projectId !== projectId) {
            throw AppError.notFound('Field task not found');
        }

        return fieldTask;
    }

    static async createFieldTask(projectId: string, data: CreateFieldTaskInput) {
        return await prisma.fieldTask.create({
            data: {
                projectId,
                title: data.title,
                description: data.description || null,
                status: data.status || 'ASSIGNED',
                priority: data.priority || 'MEDIUM',
                scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : null,
                latitude: data.latitude || null,
                longitude: data.longitude || null,
                address: data.address || null,
                assignedUserId: data.assignedUserId || null,
            },
            include: {
                photos: true,
                checklists: true,
                signatures: true,
            },
        });
    }

    static async updateFieldTask(projectId: string, taskId: string, data: UpdateFieldTaskInput) {
        await this.getFieldTask(projectId, taskId);

        const updateData: Record<string, unknown> = {};

        if (data.title !== undefined) updateData.title = data.title;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.status !== undefined) updateData.status = data.status;
        if (data.priority !== undefined) updateData.priority = data.priority;
        if (data.scheduledDate !== undefined) updateData.scheduledDate = data.scheduledDate ? new Date(data.scheduledDate) : null;
        if (data.startedAt !== undefined) updateData.startedAt = data.startedAt ? new Date(data.startedAt) : null;
        if (data.completedAt !== undefined) updateData.completedAt = data.completedAt ? new Date(data.completedAt) : null;
        if (data.durationMinutes !== undefined) updateData.durationMinutes = data.durationMinutes;
        if (data.latitude !== undefined) updateData.latitude = data.latitude;
        if (data.longitude !== undefined) updateData.longitude = data.longitude;
        if (data.address !== undefined) updateData.address = data.address;
        if (data.syncStatus !== undefined) updateData.syncStatus = data.syncStatus;
        if (data.deviceId !== undefined) updateData.deviceId = data.deviceId;
        if (data.appVersion !== undefined) updateData.appVersion = data.appVersion;

        return await prisma.fieldTask.update({
            where: { id: taskId },
            data: updateData,
            include: {
                photos: true,
                checklists: true,
                signatures: true,
            },
        });
    }

    static async deleteFieldTask(projectId: string, taskId: string) {
        await this.getFieldTask(projectId, taskId);
        await prisma.fieldTask.delete({
            where: { id: taskId },
        });
    }

    static async syncFieldTasks(projectId: string, tasks: SyncFieldTaskInput[], deviceId?: string, appVersion?: string) {
        const operations = tasks.map((task) => {
            if (task.id) {
                return prisma.fieldTask.update({
                    where: { id: task.id },
                    data: {
                        status: task.status ?? undefined,
                        completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
                        latitude: task.latitude ?? undefined,
                        longitude: task.longitude ?? undefined,
                        syncStatus: 'SYNCED',
                        deviceId: deviceId || undefined,
                        appVersion: appVersion || undefined
                    }
                });
            } else {
                return prisma.fieldTask.create({
                    data: {
                        projectId,
                        title: task.title,
                        description: task.description || null,
                        status: task.status || 'PENDING',
                        priority: task.priority || 'MEDIUM',
                        latitude: task.latitude || null,
                        longitude: task.longitude || null,
                        syncStatus: 'SYNCED',
                        deviceId: deviceId || null,
                        appVersion: appVersion || null
                    }
                });
            }
        });

        // O(1) DB trip by bundling queries in a transaction
        return await prisma.$transaction(operations);
    }

    static async getSyncStatus(projectId: string) {
        const [pendingSync, totalTasks] = await Promise.all([
            prisma.fieldTask.count({
                where: {
                    projectId,
                    syncStatus: { not: 'SYNCED' }
                }
            }),
            prisma.fieldTask.count({
                where: { projectId }
            })
        ]);

        return {
            projectId,
            totalTasks,
            pendingSync,
            syncComplete: pendingSync === 0
        };
    }
}
