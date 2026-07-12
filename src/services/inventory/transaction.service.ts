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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const existing = await (tx as any).contractorMaterialBalanceSheet.findUnique({
                where: {
                    contractorId_storeId_month: { contractorId, storeId, month }
                }
            });

            if (existing) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (tx as any).contractorBalanceSheetItem.deleteMany({
                    where: { balanceSheetId: existing.id }
                });

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return await (tx as any).contractorMaterialBalanceSheet.update({
                    where: { id: existing.id },
                    data: {
                        generatedAt: new Date(),
                        generatedBy: userId,
                        items: {
                            create: items.map((item: BalanceSheetItemInput) => ({
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
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return await (tx as any).contractorMaterialBalanceSheet.create({
                    data: {
                        contractorId,
                        storeId,
                        month,
                        generatedBy: userId,
                        items: {
                            create: items.map((item: BalanceSheetItemInput) => ({
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

    /**
     * Calculate/generate balance sheet report data for a contractor and store
     */
    static async generateReportData(params: { contractorId: string; storeId: string; month: string }) {
        const { contractorId, storeId, month } = params;
        const startDate = new Date(`${month}-01`);

        // 1. Get List of ALL Active Items
        const items = await prisma.inventoryItem.findMany({
            select: { id: true, name: true, code: true, unit: true }
        });

        // 2. Fetch Opening Balances
        const prevMonthDate = new Date(startDate.getFullYear(), startDate.getMonth() - 1, 1);
        const prevMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prevSheet = await (prisma as any).contractorMaterialBalanceSheet.findUnique({
            where: {
                contractorId_storeId_month: {
                    contractorId,
                    storeId,
                    month: prevMonthStr
                }
            },
            include: { items: true }
        });

        const openingMap = new Map<string, number>();
        if (prevSheet) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            prevSheet.items.forEach((item: any) => {
                openingMap.set(item.itemId, item.closingBalance);
            });
        }

        // 3. Fetch Issues (Received)
        const issues = await prisma.contractorMaterialIssue.findMany({
            where: {
                contractorId,
                storeId,
                month: month
            },
            include: { items: true }
        });

        const receivedMap = new Map<string, number>();
        issues.forEach(issue => {
            issue.items.forEach(item => {
                const current = receivedMap.get(item.itemId) || 0;
                receivedMap.set(item.itemId, current + item.quantity);
            });
        });

        // 4. Fetch Returns (Returned)
        const returns = await prisma.contractorMaterialReturn.findMany({
            where: {
                contractorId,
                storeId,
                month: month,
                status: 'ACCEPTED'
            },
            include: { items: true }
        });

        const returnedMap = new Map<string, number>();
        returns.forEach(ret => {
            ret.items.forEach(item => {
                const current = returnedMap.get(item.itemId) || 0;
                returnedMap.set(item.itemId, current + item.quantity);
            });
        });

        // 5. Fetch Usage (Used in SODs)
        const usageStart = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        const usageEnd = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59);

        const sods = await prisma.serviceOrder.findMany({
            where: {
                contractorId,
                sltsStatus: 'COMPLETED',
                completedDate: {
                    gte: usageStart,
                    lte: usageEnd
                }
            },
            include: { materialUsage: true }
        });

        const usedMap = new Map<string, number>();
        const wastageMap = new Map<string, number>();

        sods.forEach(sod => {
            sod.materialUsage.forEach(mu => {
                const isUsage = ['USED', 'USED_F1', 'USED_G1', 'PORTAL_SYNC'].includes(mu.usageType);
                if (isUsage) {
                    const current = usedMap.get(mu.itemId) || 0;
                    usedMap.set(mu.itemId, current + mu.quantity);
                } else if (mu.usageType === 'WASTAGE') {
                    const current = wastageMap.get(mu.itemId) || 0;
                    wastageMap.set(mu.itemId, current + mu.quantity);
                }
            });
        });

        // Fetch Direct Wastage (Reported)
        const directWastage = await prisma.contractorWastage.findMany({
            where: {
                contractorId,
                storeId,
                month: month
            },
            include: { items: true }
        });

        directWastage.forEach(dw => {
            dw.items.forEach(item => {
                const current = wastageMap.get(item.itemId) || 0;
                wastageMap.set(item.itemId, current + item.quantity);
            });
        });

        // 6. Compile Report Data
        const reportData = items.map(item => {
            const opening = openingMap.get(item.id) || 0;
            const received = receivedMap.get(item.id) || 0;
            const returned = returnedMap.get(item.id) || 0;
            const used = usedMap.get(item.id) || 0;
            const wastage = wastageMap.get(item.id) || 0;

            const closing = opening + received - returned - used - wastage;

            if (opening === 0 && received === 0 && returned === 0 && used === 0 && wastage === 0) {
                return null;
            }

            return {
                itemId: item.id,
                itemCode: item.code,
                itemName: item.name,
                unit: item.unit,
                opening,
                received,
                returned,
                used,
                wastage,
                closing
            };
        }).filter(Boolean);

        return reportData;
    }
}
