import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';

interface CreateDailyProgressInput {
    projectId: string;
    reportDate?: string | Date;
    polesErected?: number;
    cablePulled?: number;
    chambersInstalled?: number;
    closuresInstalled?: number;
    jointsCompleted?: number;
    fdpsInstalled?: number;
    teamSize?: number | null;
    hoursWorked?: number | null;
    laborCost?: number;
    progressPct?: number;
    notes?: string | null;
    photoUrls?: string[];
    reportedById?: string;
}

export class ProjectProgressService {
    static async getDailyProgress(projectId: string) {
        return await prisma.dailyProgress.findMany({
            where: { projectId },
            orderBy: { reportDate: 'desc' },
        });
    }

    static async createDailyProgress(data: CreateDailyProgressInput) {
        let record;

        await prisma.$transaction(async (tx) => {
            record = await tx.dailyProgress.create({
                data: {
                    projectId: data.projectId,
                    reportDate: data.reportDate ? new Date(data.reportDate) : new Date(),
                    polesErected: data.polesErected ?? 0,
                    cablePulled: data.cablePulled ?? 0,
                    chambersInstalled: data.chambersInstalled ?? 0,
                    closuresInstalled: data.closuresInstalled ?? 0,
                    jointsCompleted: data.jointsCompleted ?? 0,
                    fdpsInstalled: data.fdpsInstalled ?? 0,
                    teamSize: data.teamSize,
                    hoursWorked: data.hoursWorked,
                    laborCost: data.laborCost ?? 0,
                    progressPct: data.progressPct ?? 0,
                    notes: data.notes,
                    reportedById: data.reportedById,
                    photoUrls: data.photoUrls ?? [],
                },
            });

            if (data.progressPct != null) {
                await tx.project.update({
                    where: { id: data.projectId },
                    data: { progress: data.progressPct },
                });
            }
        });

        return record;
    }
}
