import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';

export class ProjectTypeService {
    static async getProjectTypes() {
        return await prisma.projectType.findMany({
            include: {
                _count: {
                    select: { projects: true, workflowTemplates: true }
                }
            },
            orderBy: { name: 'asc' }
        });
    }

    static async createProjectType(name: string, description?: string) {
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            throw AppError.badRequest('Project type name is required');
        }

        const existing = await prisma.projectType.findUnique({
            where: { name: name.trim() }
        });

        if (existing) {
            throw AppError.conflict('A project type with this name already exists');
        }

        return await prisma.projectType.create({
            data: {
                name: name.trim(),
                description: description?.trim() || ''
            }
        });
    }
}
