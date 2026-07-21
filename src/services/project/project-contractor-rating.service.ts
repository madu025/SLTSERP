import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';

interface SaveContractorRatingInput {
    projectId: string;
    contractorId: string;
    evaluationMonth: string;
    score?: number;
    productivityScore?: number | null;
    qualityScore?: number | null;
    safetyScore?: number | null;
    slaComplianceScore?: number | null;
    scheduleScore?: number | null;
    ncrCount?: number;
    ncrClosedCount?: number;
    hseIncidentCount?: number;
    completedTasksCount?: number;
    delayedTasksCount?: number;
    totalTasksAssigned?: number;
    averageRating?: number | null;
    inspectionCount?: number;
    inspectionPassCount?: number;
    evaluatedById?: string | null;
    notes?: string | null;
}

export class ProjectContractorRatingService {
    static async getRatings(projectId: string, evaluationMonth?: string | null) {
        const where: Record<string, unknown> = { projectId };
        if (evaluationMonth) {
            where.evaluationMonth = evaluationMonth;
        }

        return await prisma.contractorPerformanceScore.findMany({
            where,
            include: {
                contractor: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        contactNumber: true,
                        registrationNumber: true
                    }
                }
            },
            orderBy: [{ evaluationMonth: 'desc' }, { score: 'desc' }]
        });
    }

    static async saveRating(data: SaveContractorRatingInput) {
        const payload = {
            projectId: data.projectId,
            contractorId: data.contractorId,
            evaluationMonth: data.evaluationMonth,
            score: data.score !== undefined ? parseFloat(String(data.score)) : 0,
            productivityScore: data.productivityScore !== undefined && data.productivityScore !== null ? parseFloat(String(data.productivityScore)) : null,
            qualityScore: data.qualityScore !== undefined && data.qualityScore !== null ? parseFloat(String(data.qualityScore)) : null,
            safetyScore: data.safetyScore !== undefined && data.safetyScore !== null ? parseFloat(String(data.safetyScore)) : null,
            slaComplianceScore: data.slaComplianceScore !== undefined && data.slaComplianceScore !== null ? parseFloat(String(data.slaComplianceScore)) : null,
            scheduleScore: data.scheduleScore !== undefined && data.scheduleScore !== null ? parseFloat(String(data.scheduleScore)) : null,
            ncrCount: data.ncrCount !== undefined ? parseInt(String(data.ncrCount)) : 0,
            ncrClosedCount: data.ncrClosedCount !== undefined ? parseInt(String(data.ncrClosedCount)) : 0,
            hseIncidentCount: data.hseIncidentCount !== undefined ? parseInt(String(data.hseIncidentCount)) : 0,
            completedTasksCount: data.completedTasksCount !== undefined ? parseInt(String(data.completedTasksCount)) : 0,
            delayedTasksCount: data.delayedTasksCount !== undefined ? parseInt(String(data.delayedTasksCount)) : 0,
            totalTasksAssigned: data.totalTasksAssigned !== undefined ? parseInt(String(data.totalTasksAssigned)) : 0,
            averageRating: data.averageRating !== undefined && data.averageRating !== null ? parseFloat(String(data.averageRating)) : null,
            inspectionCount: data.inspectionCount !== undefined ? parseInt(String(data.inspectionCount)) : 0,
            inspectionPassCount: data.inspectionPassCount !== undefined ? parseInt(String(data.inspectionPassCount)) : 0,
            evaluatedById: data.evaluatedById || null,
            notes: data.notes || null
        };

        try {
            return await prisma.contractorPerformanceScore.upsert({
                where: {
                    contractorId_evaluationMonth: {
                        contractorId: data.contractorId,
                        evaluationMonth: data.evaluationMonth
                    }
                },
                create: payload,
                update: payload,
                include: {
                    contractor: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            contactNumber: true,
                            registrationNumber: true
                        }
                    }
                }
            });
        } catch (error: any) {
            if (error.code === 'P2002') {
                throw AppError.badRequest('Performance score already exists for this contractor and month');
            }
            throw error;
        }
    }
}
