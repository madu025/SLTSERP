/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';

export class ContractorPaymentService {
    static async getConfigs() {
        return (prisma as any).contractorPaymentConfig.findMany({
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

    static async createConfig(data: any, userId?: string) {
        if (!data.tiers || !Array.isArray(data.tiers) || data.tiers.length === 0) {
            throw AppError.badRequest('Pricing tiers are required');
        }

        return (prisma as any).contractorPaymentConfig.create({
            data: {
                rtomId: data.rtomId || null,
                notes: data.notes,
                createdBy: userId || undefined,
                tiers: {
                    create: data.tiers.map((t: any) => ({
                        minDistance: parseFloat(t.minDistance),
                        maxDistance: parseFloat(t.maxDistance),
                        amount: parseFloat(t.amount)
                    }))
                }
            },
            include: {
                rtom: {
                    select: {
                        id: true,
                        rtom: true,
                        name: true
                    }
                },
                tiers: true
            }
        });
    }

    static async updateConfig(id: string, data: any) {
        return (prisma as any).$transaction(async (tx: any) => {
            if (data.tiers) {
                // Delete existing tiers
                await tx.contractorPaymentTier.deleteMany({
                    where: { configId: id }
                });
            }

            // Update main config
            return await tx.contractorPaymentConfig.update({
                where: { id },
                data: {
                    rtomId: data.rtomId !== undefined ? (data.rtomId || null) : undefined,
                    notes: data.notes !== undefined ? data.notes : undefined,
                    isActive: data.isActive !== undefined ? data.isActive : undefined,
                    tiers: data.tiers ? {
                        create: data.tiers.map((t: any) => ({
                            minDistance: parseFloat(t.minDistance),
                            maxDistance: parseFloat(t.maxDistance),
                            amount: parseFloat(t.amount)
                        }))
                    } : undefined
                },
                include: {
                    rtom: {
                        select: {
                            id: true,
                            rtom: true,
                            name: true
                        }
                    },
                    tiers: true
                }
            });
        });
    }

    static async deleteConfig(id: string) {
        return (prisma as any).contractorPaymentConfig.delete({
            where: { id }
        });
    }
}
