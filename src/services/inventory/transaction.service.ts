import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { TransactionClient } from './types';

export interface BalanceSheetItemInput {
    itemId: string;
    opening: number;
    received: number;
    returned: number;
    used: number;
    wastage: number;
    closing: number;
}

export class TransactionService {
    static async getTransactions(filters: {
        storeId?: string;
        itemId?: string;
        type?: string;
        startDate?: string;
        endDate?: string;
    }) {
        const where: Prisma.InventoryTransactionWhereInput = {};

        if (filters.storeId) where.storeId = filters.storeId;
        if (filters.type) where.type = filters.type;

        if (filters.itemId) {
            where.items = {
                some: { itemId: filters.itemId }
            };
        }

        if (filters.startDate && filters.endDate) {
            where.date = {
                gte: new Date(filters.startDate),
                lte: new Date(filters.endDate)
            };
        }

        return await prisma.inventoryTransaction.findMany({
            where,
            include: {
                store: { select: { name: true, type: true } },
                items: {
                    include: {
                        item: { select: { code: true, name: true, unit: true } }
                    }
                },
            },
            orderBy: { date: 'desc' }
        });
    }

    static async saveBalanceSheet(data: {
        contractorId: string;
        storeId: string;
        month: string;
        items: BalanceSheetItemInput[];
        userId: string;
    }) {
        const { contractorId, storeId, month, items, userId } = data;

        if (!contractorId || !storeId || !month || !items) {
            throw new Error('MISSING_FIELDS');
        }

        return await prisma.$transaction(async (tx: TransactionClient) => {
            const existing = await tx.contractorMaterialBalanceSheet.findUnique({
                where: {
                    contractorId_storeId_month: { contractorId, storeId, month }
                }
            });

            if (existing) {
                await tx.contractorBalanceSheetItem.deleteMany({
                    where: { balanceSheetId: existing.id }
                });

                return await tx.contractorMaterialBalanceSheet.update({
                    where: { id: existing.id },
                    data: {
                        generatedAt: new Date(),
                        generatedBy: userId,
                        items: {
                            create: items.map((item) => ({
                                itemId: item.itemId,
                                openingBalance: item.opening,
                                received: item.received,
                                returned: item.returned,
                                used: item.used,
                                wastage: item.wastage,
                                closingBalance: item.closing
                            }))
                        }
                    }
                });
            } else {
                return await tx.contractorMaterialBalanceSheet.create({
                    data: {
                        contractorId,
                        storeId,
                        month,
                        generatedBy: userId,
                        items: {
                            create: items.map((item) => ({
                                itemId: item.itemId,
                                openingBalance: item.opening,
                                received: item.received,
                                returned: item.returned,
                                used: item.used,
                                wastage: item.wastage,
                                closingBalance: item.closing
                            }))
                        }
                    }
                });
            }
        });
    }
}
