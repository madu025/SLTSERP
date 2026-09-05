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

    static async createManyAndReturn(data: Prisma.NotificationUncheckedCreateInput[], tx?: any) {
        const client = tx || prisma;
        return client.notification.createManyAndReturn({ data });
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

    static async findCursorPaginated(params: {
        userId: string;
        tenantId?: string;
        limit?: number;
        cursor?: string;
        tx?: any;
    }) {
        const { userId, tenantId, limit = 20, cursor, tx } = params;
        const client = tx || prisma;
        const items = await client.notification.findMany({
            take: limit + 1,
            cursor: cursor ? { id: cursor } : undefined,
            skip: cursor ? 1 : 0,
            where: {
                userId,
                ...(tenantId && { tenantId })
            },
            orderBy: { createdAt: 'desc' }
        });

        let nextCursor: string | undefined = undefined;
        if (items.length > limit) {
            const nextItem = items.pop();
            nextCursor = nextItem?.id;
        }

        return {
            items,
            nextCursor
        };
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

    /**
     * Category-based upsert: replaces any existing UNREAD notification with the
     * same userId + type + link combination. If found, updates it in-place and
     * increments groupedCount to track consolidation. If not found, creates new.
     *
     * This prevents notification table bloat from repeated events of the same
     * category (e.g. multiple SOD status updates for the same link).
     */
    static async replaceUnreadByCategory(
        userId: string,
        type: string,
        link: string | null | undefined,
        data: {
            title: string;
            message: string;
            priority?: string;
            metadata?: Record<string, unknown> | null;
        },
        tx?: any
    ) {
        const client = tx || prisma;

        // Find the latest unread notification in this category
        const existing = await client.notification.findFirst({
            where: {
                userId,
                type,
                link: link ?? null,
                isRead: false,
            },
            orderBy: { createdAt: 'desc' },
        });

        if (existing) {
            // Update in-place: replace content, bump groupedCount, refresh timestamp
            const updated = await client.notification.update({
                where: { id: existing.id },
                data: {
                    title: data.title,
                    message: data.message,
                    priority: data.priority ?? existing.priority,
                    ...(data.metadata !== undefined ? { metadata: data.metadata } : {}),
                    groupedCount: { increment: 1 },
                    updatedAt: new Date(),
                },
            });
            return { notification: updated, replaced: true };
        }

        // No existing unread -- create fresh
        const created = await client.notification.create({
            data: {
                userId,
                type,
                link: link ?? null,
                title: data.title,
                message: data.message,
                priority: data.priority ?? 'MEDIUM',
                ...(data.metadata !== undefined ? { metadata: data.metadata } : {}),
                groupedCount: 1,
            },
        });
        return { notification: created, replaced: false };
    }

    /**
     * Dedup-keyed upsert: at most one row per (userId, dedupHash).
     *
     * Unlike replaceUnreadByCategory this survives the recipient reading the notification (a
     * replacement only ever targets unread rows, so an acknowledged alert re-inserts), and it does
     * not collapse unrelated events that merely share a link. Repeat events for the same key bump
     * groupedCount on the existing row instead of inserting, which is what keeps a re-asserted
     * business event (a SOD the sync keeps reporting as completed) from becoming a new alert.
     *
     * Read-then-write rather than a real upsert: prisma `upsert` cannot express "increment on
     * conflict", and the guard is per user + key, so the worst case of two concurrent writers is
     * one extra row. The partial unique index on ("userId", "dedupHash") closes that race.
     */
    static async upsertByDedupKey(
        userId: string,
        dedupHash: string,
        data: {
            title: string;
            message: string;
            type?: string;
            priority?: string;
            link?: string | null;
            metadata?: Prisma.InputJsonValue;
        }
    ) {
        const existing = await prisma.notification.findFirst({
            where: { userId, dedupHash },
            orderBy: { createdAt: 'desc' },
            select: { id: true },
        });

        if (existing) {
            const updated = await prisma.notification.update({
                where: { id: existing.id },
                data: {
                    title: data.title,
                    message: data.message,
                    ...(data.priority ? { priority: data.priority } : {}),
                    ...(data.metadata !== undefined ? { metadata: data.metadata } : {}),
                    groupedCount: { increment: 1 },
                },
            });
            return { notification: updated, replaced: true };
        }

        const created = await prisma.notification.create({
            data: {
                userId,
                dedupHash,
                title: data.title,
                message: data.message,
                type: data.type ?? 'SYSTEM',
                priority: data.priority ?? 'MEDIUM',
                link: data.link ?? null,
                ...(data.metadata !== undefined ? { metadata: data.metadata } : {}),
                groupedCount: 1,
            },
        });
        return { notification: created, replaced: false };
    }

    /**
     * Retention for dedup-keyed alerts: keep the newest row per (userId, dedupHash) and drop the
     * earlier ones.
     *
     * `upsertByDedupKey` already prevents new duplicates, but the partial unique index only covers
     * rows written after it landed, and any write that raced a concurrent insert left a second row
     * behind. A superseded row is dead weight in the bell (it renders as a repeat of the same
     * alert), so the weekly sweep collapses each key back to one row. One statement rather than a
     * read-then-delete loop: the table is large and the rule is a pure set operation.
     */
    static async deleteSupersededByDedupKey(): Promise<number> {
        return prisma.$executeRaw`
            WITH keep AS (
                SELECT DISTINCT ON ("userId", "dedupHash") id
                FROM "Notification"
                WHERE "dedupHash" IS NOT NULL
                ORDER BY "userId", "dedupHash", "createdAt" DESC, "id" DESC
            )
            DELETE FROM "Notification"
            WHERE "dedupHash" IS NOT NULL
              AND id NOT IN (SELECT id FROM keep)
        `;
    }
}
