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
    static async createRisk(projectId: string, data: CreateRiskInput, actorUserId: string) {
        const { title, description, probability, impact, mitigationPlan } = data;
        const prob = Number(probability);
        const imp = Number(impact);
        if (!actorUserId) throw AppError.unauthorized('Authenticated risk actor is required');
        if (!Number.isInteger(prob) || prob < 1 || prob > 5 || !Number.isInteger(imp) || imp < 1 || imp > 5) {
            throw AppError.badRequest('Risk probability and impact must be integers from 1 to 5');
        }
        return await prisma.projectRisk.create({
            data: {
                projectId,
                title,
                description,
                probability: prob,
                impact: imp,
                score: prob * imp,
                mitigationPlan: mitigationPlan || null,
                identifiedById: actorUserId,
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
