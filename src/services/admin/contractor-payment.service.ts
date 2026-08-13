import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';

export interface PaymentTierInput {
    minDistance: number | string;
    maxDistance: number | string;
    amount: number | string;
}

export interface CreatePaymentConfigInput {
    rtomId?: string | null;
    notes?: string;
    tiers: PaymentTierInput[];
}

export interface UpdatePaymentConfigInput {
    rtomId?: string | null;
    notes?: string;
    isActive?: boolean;
    tiers?: PaymentTierInput[];
}

function mapTier(t: PaymentTierInput) {
    return {
        minDistance: parseFloat(String(t.minDistance)),
        maxDistance: parseFloat(String(t.maxDistance)),
        amount: parseFloat(String(t.amount))
    };
}

const rtomSelect = {
    select: { id: true, rtom: true, name: true }
} as const;

export class ContractorPaymentService {
    static async getConfigs() {
        return prisma.contractorPaymentConfig.findMany({
            include: {
                rtom: {
                    select: {
                        id: true,
                        rtom: true,
                        name: true
                    }
                },
                tiers: true
            },
            orderBy: [
                { rtomId: 'asc' },
                { createdAt: 'desc' }
            ]
        });
    }

    static async createConfig(data: CreatePaymentConfigInput, userId?: string) {
        if (!data.tiers || !Array.isArray(data.tiers) || data.tiers.length === 0) {
            throw AppError.badRequest('Pricing tiers are required');
        }

        return prisma.contractorPaymentConfig.create({
            data: {
                rtomId: data.rtomId || null,
                notes: data.notes,
                createdBy: userId || undefined,
                tiers: {
                    create: data.tiers.map(mapTier)
                }
            },
            include: {
                rtom: rtomSelect,
                tiers: true
            }
        });
    }

    static async updateConfig(id: string, data: UpdatePaymentConfigInput) {
        return prisma.$transaction(async (tx) => {
            if (data.tiers) {
                await tx.contractorPaymentTier.deleteMany({
                    where: { configId: id }
                });
            }

            return await tx.contractorPaymentConfig.update({
                where: { id },
                data: {
                    rtomId: data.rtomId !== undefined ? (data.rtomId || null) : undefined,
                    notes: data.notes !== undefined ? data.notes : undefined,
                    isActive: data.isActive !== undefined ? data.isActive : undefined,
                    tiers: data.tiers ? {
                        create: data.tiers.map(mapTier)
                    } : undefined
                },
                include: {
                    rtom: rtomSelect,
                    tiers: true
                }
            });
        });
    }

    static async deleteConfig(id: string) {
        return prisma.contractorPaymentConfig.delete({
            where: { id }
        });
    }
}
