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
    /**
     * Get list of LD/Penalties for a project
     */
    static async getPenalties(projectId: string) {
        const penalties = await prisma.projectLDPenalty.findMany({
            where: { projectId },
            orderBy: { createdAt: 'desc' },
        });
        return penalties;
    }

    /**
     * Create a new LD/Penalty
     */
    static async createPenalty(data: CreatePenaltyInput) {
        const {
            projectId, title, description, type, category, amount,
            percentage, referenceTable, referenceId, referenceDesc,
            appliedDate, leviedById, remarks,
        } = data;

        const penalty = await prisma.projectLDPenalty.create({
            data: {
                projectId,
                title,
                description: description || null,
                type: type || 'LD',
                category: category || 'DELAY',
                amount,
                percentage: percentage || null,
                referenceTable: referenceTable || null,
                referenceId: referenceId || null,
                referenceDesc: referenceDesc || null,
                waivedAmount: 0,
                netAmount: amount,
                appliedDate: appliedDate ? new Date(appliedDate) : new Date(),
                leviedById: leviedById || null,
                remarks: remarks || null,
                status: 'PROPOSED',
            },
        });

        return penalty;
    }

    /**
     * Update LD/Penalty status and parameters
     */
    static async updatePenalty(id: string, status: string, options: UpdatePenaltyOptions) {
        const existing = await prisma.projectLDPenalty.findUnique({ where: { id } });
        if (!existing) {
            throw AppError.badRequest('LD_PENALTY_NOT_FOUND');
        }

        const updateData: Record<string, unknown> = { status };

        if (status === 'APPROVED' || status === 'WAIVED') {
            updateData.approvedById = options.approvedById || null;
            updateData.approvedAt = new Date();
        }

        if (options.waivedAmount !== undefined) {
            updateData.waivedAmount = options.waivedAmount;
            updateData.netAmount = existing.amount - options.waivedAmount;
        }

        if (options.remarks) updateData.remarks = options.remarks;

        const penalty = await prisma.projectLDPenalty.update({
            where: { id },
            data: updateData,
        });

        return penalty;
    }

    /**
     * Delete a penalty (PROPOSED status only)
     */
    static async deletePenalty(id: string) {
        const existing = await prisma.projectLDPenalty.findUnique({ where: { id } });
        if (!existing) {
            throw AppError.badRequest('LD_PENALTY_NOT_FOUND');
        }

        if (existing.status !== 'PROPOSED') {
            throw AppError.badRequest('PROPOSED_ONLY_DELETION');
        }

        await prisma.projectLDPenalty.delete({ where: { id } });
        return { success: true };
    }
}
