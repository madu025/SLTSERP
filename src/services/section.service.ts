import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { SystemService } from '@/services/system.service';

export class SectionService {
    /**
     * Fetch all sections with basic stats.
     */
    static async getSections() {
        return prisma.section.findMany({
            include: {
                _count: {
                    select: {
                        roles: true,
                        userAssignments: true
                    }
                }
            },
            orderBy: { name: 'asc' }
        });
    }

    /**
     * Create a new section.
     */
    static async createSection(data: { name: string, code: string, description?: string, icon?: string, color?: string }, userId: string) {
        const section = await prisma.section.create({
            data: {
                name: data.name,
                code: data.code.toUpperCase(),
                description: data.description,
                icon: data.icon,
                color: data.color
            }
        });

        await SystemService.logEvent({
            userId,
            action: 'SECTION_CREATE',
            entity: 'Section',
            entityId: section.id,
            newValue: section
        });

        return section;
    }

    /**
     * Update an existing section.
     */
    static async updateSection(id: string, data: { name?: string, code?: string, description?: string, icon?: string, color?: string, isActive?: boolean }, userId: string) {
        const existing = await prisma.section.findUnique({ where: { id } });
        if (!existing) throw AppError.badRequest('SECTION_NOT_FOUND');

        const section = await prisma.section.update({
            where: { id },
            data: {
                ...(data.name && { name: data.name }),
                ...(data.code && { code: data.code.toUpperCase() }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.icon !== undefined && { icon: data.icon }),
                ...(data.color !== undefined && { color: data.color }),
                ...(data.isActive !== undefined && { isActive: data.isActive })
            }
        });

        await SystemService.logEvent({
            userId,
            action: 'SECTION_UPDATE',
            entity: 'Section',
            entityId: section.id,
            oldValue: existing,
            newValue: section
        });

        return section;
    }

    /**
     * Delete a section.
     */
    static async deleteSection(id: string, userId: string) {
        const existing = await prisma.section.findUnique({ where: { id } });
        if (!existing) throw AppError.badRequest('SECTION_NOT_FOUND');

        await prisma.section.delete({
            where: { id }
        });

        await SystemService.logEvent({
            userId,
            action: 'SECTION_DELETE',
            entity: 'Section',
            entityId: id,
            oldValue: existing
        });

        return { success: true };
    }
}
