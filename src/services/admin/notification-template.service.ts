import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';

export interface CreateTemplateInput {
    code: string;
    title: string;
    message: string;
    subject?: string | null;
    htmlBody?: string | null;
    entityType?: string | null;
    isActive?: boolean;
    channels?: string[];
}

export interface UpdateTemplateInput {
    id: string;
    code?: string;
    title?: string;
    message?: string;
    subject?: string | null;
    htmlBody?: string | null;
    entityType?: string | null;
    isActive?: boolean;
    channels?: string[];
}

export interface TemplateFilter {
    entityType?: string | null;
    isActive?: boolean;
}

export class NotificationTemplateService {
    static async list(filter: TemplateFilter) {
        const where: Record<string, unknown> = {};
        if (filter.entityType) where.entityType = filter.entityType;
        if (filter.isActive !== undefined) where.isActive = filter.isActive;

        return prisma.notificationTemplate.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });
    }

    static async create(data: CreateTemplateInput) {
        const existing = await prisma.notificationTemplate.findUnique({
            where: { code: data.code }
        });

        if (existing) {
            throw AppError.conflict('Template with this code already exists');
        }

        return prisma.notificationTemplate.create({
            data: {
                code: data.code,
                title: data.title,
                message: data.message,
                subject: data.subject,
                htmlBody: data.htmlBody,
                entityType: data.entityType,
                isActive: data.isActive ?? true,
                channels: data.channels ?? ['EMAIL']
            }
        });
    }

    static async update(data: UpdateTemplateInput) {
        return prisma.notificationTemplate.update({
            where: { id: data.id },
            data: {
                ...(data.title !== undefined && { title: data.title }),
                ...(data.message !== undefined && { message: data.message }),
                ...(data.subject !== undefined && { subject: data.subject }),
                ...(data.htmlBody !== undefined && { htmlBody: data.htmlBody }),
                ...(data.entityType !== undefined && { entityType: data.entityType }),
                ...(data.isActive !== undefined && { isActive: data.isActive }),
                ...(data.channels !== undefined && { channels: data.channels })
            }
        });
    }

    static async delete(id: string) {
        await prisma.notificationTemplate.delete({ where: { id } });
        return { success: true };
    }

    static async getById(id: string) {
        const template = await prisma.notificationTemplate.findUnique({
            where: { id }
        });
        if (!template) {
            throw AppError.notFound('Template not found');
        }
        return template;
    }
}
