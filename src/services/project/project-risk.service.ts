import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';

interface CreateRiskInput {
    title: string;
    description: string;
    probability: string | number;
    impact: string | number;
    mitigationPlan?: string;
    identifiedById: string;
}

interface UpdateRiskInput {
    mitigationPlan?: string;
    status?: string;
}

export class ProjectRiskService {
    static async getRisks(projectId: string) {
        return await prisma.projectRisk.findMany({
            where: { projectId },
            orderBy: { score: 'desc' } // Prioritize high score risks
        });
    }

    static async createRisk(projectId: string, data: CreateRiskInput) {
        const { title, description, probability, impact, mitigationPlan, identifiedById } = data;

        const prob = Number(probability);
        const imp = Number(impact);

        return await prisma.projectRisk.create({
            data: {
                projectId,
                title,
                description,
                probability: prob,
                impact: imp,
                score: prob * imp,
                mitigationPlan: mitigationPlan || null,
                identifiedById,
                status: 'OPEN'
            }
        });
    }

    static async updateRisk(riskId: string, data: UpdateRiskInput) {
        const { mitigationPlan, status } = data;

        return await prisma.projectRisk.update({
            where: { id: riskId },
            data: {
                mitigationPlan: mitigationPlan !== undefined ? mitigationPlan : undefined,
                status: status !== undefined ? status : undefined
            }
        });
    }
}
