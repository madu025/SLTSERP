import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { Prisma } from '@prisma/client';

interface CreateInspectionInput {
    title: string;
    category: string;
    checklist: Prisma.InputJsonValue;
    inspectorId: string;
}

interface UpdateInspectionInput {
    status?: string;
    checklist?: Prisma.InputJsonValue;
    correctiveAction?: string;
    photoUrls?: string[];
}

export class ProjectInspectionService {
    static async getInspections(projectId: string) {
        return await prisma.projectInspection.findMany({
            where: { projectId },
            orderBy: { createdAt: 'desc' }
        });
    }

    static async createInspection(projectId: string, data: CreateInspectionInput) {
        const { title, category, checklist, inspectorId } = data;

        return await prisma.projectInspection.create({
            data: {
                projectId,
                title,
                category,
                checklist,
                inspectorId,
                status: 'PENDING'
            }
        });
    }

    static async updateInspection(inspectionId: string, data: UpdateInspectionInput) {
        const { status, checklist, correctiveAction, photoUrls } = data;

        return await prisma.projectInspection.update({
            where: { id: inspectionId },
            data: {
                status: status ?? undefined,
                checklist: checklist ?? undefined,
                correctiveAction: correctiveAction ?? undefined,
                photoUrls: photoUrls ?? undefined,
                inspectedAt: status !== undefined ? new Date() : undefined
            }
        });
    }
}
