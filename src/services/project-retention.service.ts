import { prisma } from '@/lib/prisma';

interface CreateRetentionInput {
    projectId: string;
    invoiceId?: string | null;
    title: string;
    description?: string | null;
    retentionPercent?: number;
    retentionAmount: number;
    releaseCondition?: string | null;
    defectLiabilityPeriod?: number | null;
}

interface UpdateRetentionInput {
    retentionPercent?: number;
    retentionAmount?: number;
    status?: string;
    releaseCondition?: string | null;
    defectLiabilityPeriod?: number | null;
}

export class ProjectRetentionService {
    /**
     * Get list of retentions for a project
     */
    static async getRetentions(projectId: string) {
        const retentions = await prisma.projectRetention.findMany({
            where: { projectId },
            include: {
                releases: { orderBy: { releaseDate: 'desc' } },
                invoice: {
                    select: { invoiceNumber: true, title: true, totalAmount: true }
                }
            },
            orderBy: { createdAt: 'desc' },
        });
        return retentions;
    }

    /**
     * Create a new retention entry
     */
    static async createRetention(data: CreateRetentionInput) {
        const {
            projectId, invoiceId, title, description, retentionPercent,
            retentionAmount, releaseCondition, defectLiabilityPeriod,
        } = data;

        const retention = await prisma.projectRetention.create({
            data: {
                projectId,
                invoiceId: invoiceId || null,
                title,
                description: description || null,
                retentionPercent: retentionPercent || 10,
                retentionAmount,
                releasedAmount: 0,
                balanceAmount: retentionAmount,
                releaseCondition: releaseCondition || null,
                defectLiabilityPeriod: defectLiabilityPeriod || null,
                defectLiabilityEnd: defectLiabilityPeriod
                    ? new Date(Date.now() + (defectLiabilityPeriod * 24 * 60 * 60 * 1000))
                    : null,
                status: 'HELD',
            },
            include: { releases: true },
        });

        return retention;
    }

    /**
     * Release retention in a transaction
     */
    static async releaseRetention(
        id: string,
        releaseAmount: number,
        releaseDate?: string | Date,
        approvedById?: string | null,
        remarks?: string | null
    ) {
        const existing = await prisma.projectRetention.findUnique({ where: { id } });
        if (!existing) {
            throw new Error('RETENTION_NOT_FOUND');
        }

        if (releaseAmount > existing.balanceAmount) {
            throw new Error('RELEASE_AMOUNT_EXCEEDS_BALANCE');
        }

        const newReleased = (existing.releasedAmount || 0) + releaseAmount;
        const newBalance = existing.retentionAmount - newReleased;
        const newStatus = newBalance <= 0 ? 'FULLY_RELEASED' : 'PARTIALLY_RELEASED';

        // Use transaction to create release and update retention
        const retention = await prisma.$transaction(async (tx) => {
            await tx.retentionRelease.create({
                data: {
                    retentionId: id,
                    releaseAmount,
                    releaseDate: releaseDate ? new Date(releaseDate) : new Date(),
                    approvedById: approvedById || null,
                    approvedAt: new Date(),
                    remarks: remarks || null,
                },
            });

            return tx.projectRetention.update({
                where: { id },
                data: {
                    releasedAmount: newReleased,
                    balanceAmount: newBalance,
                    status: newStatus,
                },
                include: { releases: { orderBy: { releaseDate: 'desc' } } },
            });
        });

        return retention;
    }

    /**
     * Update a retention entry
     */
    static async updateRetention(id: string, updateData: UpdateRetentionInput) {
        const existing = await prisma.projectRetention.findUnique({ where: { id } });
        if (!existing) {
            throw new Error('RETENTION_NOT_FOUND');
        }

        const data: Record<string, unknown> = {};
        if (updateData.retentionPercent !== undefined) data.retentionPercent = updateData.retentionPercent;
        if (updateData.retentionAmount !== undefined) {
            data.retentionAmount = updateData.retentionAmount;
            data.balanceAmount = updateData.retentionAmount - (existing.releasedAmount || 0);
        }
        if (updateData.status !== undefined) data.status = updateData.status;
        if (updateData.releaseCondition !== undefined) data.releaseCondition = updateData.releaseCondition;
        if (updateData.defectLiabilityPeriod !== undefined && updateData.defectLiabilityPeriod !== null) {
            data.defectLiabilityPeriod = updateData.defectLiabilityPeriod;
            data.defectLiabilityEnd = new Date(Date.now() + (updateData.defectLiabilityPeriod * 24 * 60 * 60 * 1000));
        }

        const retention = await prisma.projectRetention.update({
            where: { id },
            data,
            include: { releases: { orderBy: { releaseDate: 'desc' } } },
        });

        return retention;
    }

    /**
     * Delete a retention
     */
    static async deleteRetention(id: string) {
        const existing = await prisma.projectRetention.findUnique({ where: { id } });
        if (!existing) {
            throw new Error('RETENTION_NOT_FOUND');
        }

        if ((existing.releasedAmount || 0) > 0) {
            throw new Error('HAS_RELEASES');
        }

        await prisma.projectRetention.delete({ where: { id } });
        return { success: true };
    }
}
