import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';

export interface CreateRevenueConfigInput {
    rtomId?: string | null;
    revenuePerSOD: number | string;
    effectiveFrom?: string | Date | null;
    effectiveTo?: string | Date | null;
    circularRef?: string;
    notes?: string;
}

export interface UpdateRevenueConfigInput extends Partial<CreateRevenueConfigInput> {
    isActive?: boolean;
}

export class SodRevenueService {
    static async getConfigs() {
        return prisma.sODRevenueConfig.findMany({
            include: {
                rtom: {
                    select: {
                        id: true,
                        rtom: true,
                        name: true
                    }
                }
            },
            orderBy: [
                { rtomId: 'asc' },
                { effectiveFrom: 'desc' }
            ]
        });
    }

    static async createConfig(data: CreateRevenueConfigInput, userId?: string) {
        if (!data.revenuePerSOD || Number(data.revenuePerSOD) <= 0) {
            throw AppError.badRequest('Invalid revenue amount');
        }

        if (data.effectiveFrom && data.effectiveTo) {
            const from = new Date(data.effectiveFrom);
            const to = new Date(data.effectiveTo);
            if (from >= to) {
                throw AppError.badRequest('Invalid date range');
            }
        }

        return prisma.sODRevenueConfig.create({
            data: {
                rtomId: data.rtomId || null,
                revenuePerSOD: Number(data.revenuePerSOD),
                effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : null,
                effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
                circularRef: data.circularRef,
                notes: data.notes,
                createdBy: userId || undefined
            },
            include: {
                rtom: {
                    select: {
                        id: true,
                        rtom: true,
                        name: true
                    }
                }
            }
        });
    }

    static async updateConfig(id: string, data: UpdateRevenueConfigInput) {
        if (data.effectiveFrom && data.effectiveTo) {
            const from = new Date(data.effectiveFrom);
            const to = new Date(data.effectiveTo);
            if (from >= to) {
                throw AppError.badRequest('Invalid date range');
            }
        }

        const updateData: any = {};
        if (data.revenuePerSOD !== undefined) updateData.revenuePerSOD = Number(data.revenuePerSOD);
        if (data.effectiveFrom !== undefined) updateData.effectiveFrom = data.effectiveFrom ? new Date(data.effectiveFrom) : null;
        if (data.effectiveTo !== undefined) updateData.effectiveTo = data.effectiveTo ? new Date(data.effectiveTo) : null;
        if (data.circularRef !== undefined) updateData.circularRef = data.circularRef;
        if (data.notes !== undefined) updateData.notes = data.notes;
        if (data.isActive !== undefined) updateData.isActive = data.isActive;

        try {
            return await prisma.sODRevenueConfig.update({
                where: { id },
                data: updateData,
                include: {
                    rtom: {
                        select: {
                            id: true,
                            rtom: true,
                            name: true
                        }
                    }
                }
            });
        } catch (error: any) {
            if (error.code === 'P2025') throw AppError.notFound('Configuration not found');
            throw error;
        }
    }

    static async deleteConfig(id: string) {
        try {
            await prisma.sODRevenueConfig.delete({
                where: { id }
            });
            return { success: true };
        } catch (error: any) {
            if (error.code === 'P2025') throw AppError.notFound('Configuration not found');
            throw error;
        }
    }

    /**
     * Utility function to get revenue for a specific SOD
     */
    static async getRevenueForSOD(
        rtomId: string,
        completedDate: Date
    ): Promise<number> {

        // Step 1: Check for RTOM-specific rate with date range
        const rtomWithDate = await prisma.sODRevenueConfig.findFirst({
            where: {
                rtomId: rtomId,
                effectiveFrom: { lte: completedDate },
                effectiveTo: { gte: completedDate },
                isActive: true
            },
            orderBy: { createdAt: 'desc' }
        });
        if (rtomWithDate) return Number(rtomWithDate.revenuePerSOD);

        // Step 2: Check for RTOM-specific rate (permanent)
        const rtomPermanent = await prisma.sODRevenueConfig.findFirst({
            where: {
                rtomId: rtomId,
                effectiveFrom: null,
                effectiveTo: null,
                isActive: true
            },
            orderBy: { createdAt: 'desc' }
        });
        if (rtomPermanent) return Number(rtomPermanent.revenuePerSOD);

        // Step 3: Get default rate
        const defaultRate = await prisma.sODRevenueConfig.findFirst({
            where: {
                rtomId: null, // Default for all RTOMs
                isActive: true
            },
            orderBy: { createdAt: 'desc' }
        });

        return defaultRate ? Number(defaultRate.revenuePerSOD) : 10500; // Fallback to Rs. 10,500
    }
}
