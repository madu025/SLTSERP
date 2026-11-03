import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { AppError } from '@/lib/error';
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
    static async createInspection(projectId: string, data: CreateInspectionInput, actorUserId: string) {
        const { title, category, checklist } = data;
        if (!actorUserId) throw AppError.unauthorized('Authenticated inspection actor is required');
        return await prisma.projectInspection.create({
            data: {
                projectId,
                title,
                category,
                checklist,
                inspectorId: actorUserId,
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
