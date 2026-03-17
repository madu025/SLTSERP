/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

/**
 * NotificationRepository
 * ----------------------
 * Handles database operations for notifications and preferences.
 */
export class NotificationRepository {
    
    // Notifications CRUD
    static async create(data: Prisma.NotificationUncheckedCreateInput, tx?: any) {
        const client = tx || prisma;
        return client.notification.create({ data });
    }

    static async createMany(data: Prisma.NotificationUncheckedCreateInput[], tx?: any) {
        const client = tx || prisma;
        return client.notification.createMany({ data });
    }

    static async update(id: string, data: Prisma.NotificationUncheckedUpdateInput, tx?: any) {
        const client = tx || prisma;
        return client.notification.update({ where: { id }, data });
    }

    static async updateMany(where: Prisma.NotificationWhereInput, data: Prisma.NotificationUncheckedUpdateInput, tx?: any) {
        const client = tx || prisma;
        return client.notification.updateMany({ where, data });
    }

    static async deleteMany(where: Prisma.NotificationWhereInput, tx?: any) {
        const client = tx || prisma;
        return client.notification.deleteMany({ where });
    }

    static async findMany(args: Prisma.NotificationFindManyArgs, tx?: any) {
        const client = tx || prisma;
        return client.notification.findMany(args);
    }

    static async count(where: Prisma.NotificationWhereInput, tx?: any) {
        const client = tx || prisma;
        return client.notification.count({ where });
    }

    // Preferences
    static async findPreference(userId: string, type: string, tx?: any) {
        const client = tx || prisma;
        return (client as any).notificationPreference.findUnique({
            where: { userId_type: { userId, type } }
        });
    }

    static async findDisabledPreferences(userIds: string[], type: string, tx?: any) {
        const client = tx || prisma;
        return (client as any).notificationPreference.findMany({
            where: {
                userId: { in: userIds },
                type,
                enabled: false
            },
            select: { userId: true }
        });
    }
}
