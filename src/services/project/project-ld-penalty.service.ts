import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';

interface CreatePenaltyInput {
    projectId: string;
    title: string;
    description?: string | null;
    type?: string;
    category?: string;
    amount: number;
    percentage?: number | null;
    referenceTable?: string | null;
    referenceId?: string | null;
    referenceDesc?: string | null;
    appliedDate?: string | Date;
    leviedById?: string | null;
    remarks?: string | null;
}

interface UpdatePenaltyOptions {
    approvedById?: string | null;
    waivedAmount?: number;
    remarks?: string | null;
}

export class ProjectLDPenaltyService {
    static async getPenalties(projectId: string) {
        return prisma.projectLDPenalty.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } });
    }

    static async createPenalty(data: CreatePenaltyInput) {
        if (!Number.isFinite(data.amount) || data.amount <= 0) throw AppError.badRequest('INVALID_PENALTY_AMOUNT');
        if (data.percentage !== undefined && data.percentage !== null
            && (!Number.isFinite(data.percentage) || data.percentage < 0 || data.percentage > 100)) {
            throw AppError.badRequest('INVALID_PENALTY_PERCENTAGE');
        }
        if (!data.leviedById) throw AppError.badRequest('LEVIED_BY_ID_REQUIRED');

        const project = await prisma.project.findUnique({ where: { id: data.projectId }, select: { id: true } });
        if (!project) throw AppError.badRequest('PROJECT_NOT_FOUND');

        return prisma.projectLDPenalty.create({
            data: {
                projectId: data.projectId,
                title: data.title,
                description: data.description || null,
                type: data.type || 'LD',
                category: data.category || 'DELAY',
                amount: data.amount,
                percentage: data.percentage ?? null,
                referenceTable: data.referenceTable || null,
                referenceId: data.referenceId || null,
                referenceDesc: data.referenceDesc || null,
                waivedAmount: 0,
                netAmount: data.amount,
                appliedDate: data.appliedDate ? new Date(data.appliedDate) : new Date(),
                leviedById: data.leviedById,
                remarks: data.remarks || null,
                status: 'PROPOSED',
            },
        });
    }

    static async updatePenalty(id: string, status: string, options: UpdatePenaltyOptions) {
        const existing = await prisma.projectLDPenalty.findUnique({ where: { id } });
        if (!existing) throw AppError.badRequest('LD_PENALTY_NOT_FOUND');
        if (existing.status !== 'PROPOSED') throw AppError.badRequest('ONLY_PROPOSED_PENALTIES_CAN_BE_ACTIONED');
        if (!['APPROVED', 'WAIVED', 'REJECTED'].includes(status)) throw AppError.badRequest('INVALID_LD_PENALTY_STATUS');
        if (!options.approvedById) throw AppError.badRequest('APPROVED_BY_ID_REQUIRED');
        if (existing.leviedById && existing.leviedById === options.approvedById) {
            throw AppError.badRequest('MAKER_CANNOT_APPROVE_OWN_PENALTY');
        }

        const amount = Number(existing.amount);
        const waivedAmount = status === 'WAIVED' ? (options.waivedAmount ?? amount) : 0;
        if (!Number.isFinite(waivedAmount) || waivedAmount < 0 || waivedAmount > amount) {
            throw AppError.badRequest('INVALID_WAIVED_AMOUNT');
        }
        if (status !== 'WAIVED' && options.waivedAmount !== undefined) {
            throw AppError.badRequest('WAIVER_ALLOWED_ONLY_FOR_WAIVED_PENALTIES');
        }

        return prisma.projectLDPenalty.update({
            where: { id },
            data: {
                status,
                approvedById: options.approvedById,
                approvedAt: new Date(),
                waivedAmount,
                netAmount: amount - waivedAmount,
                ...(options.remarks !== undefined ? { remarks: options.remarks } : {}),
            },
        });
    }

    static async deletePenalty(id: string) {
        const existing = await prisma.projectLDPenalty.findUnique({ where: { id } });
        if (!existing) throw AppError.badRequest('LD_PENALTY_NOT_FOUND');
        if (existing.status !== 'PROPOSED') throw AppError.badRequest('PROPOSED_ONLY_DELETION');
        await prisma.projectLDPenalty.delete({ where: { id } });
        return { success: true };
    }
}
