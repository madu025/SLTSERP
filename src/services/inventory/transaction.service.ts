import { ContractorStoreService } from '@/services/inventory/contractor-store.service';
import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { TransactionClient } from '@/types/inventory/inventory-service.types';
import { AuditService } from '@/services/audit/audit.service';
import { ContractorBalanceService, monthPeriod } from '@/services/inventory/contractor-balance.service';

export interface BalanceSheetItemInput {
    itemId: string;
    opening: number;
    received: number;
    returned: number;
    used: number;
    wastage: number;
    closing: number;
}

interface MaterialStats {
    id: string;
    code: string;
    name: string;
    unit: string;
    issued: number;
    used: number;
    wastage: number;
    returned: number;
    balance: number;
    costPrice: number;
    totalValue: number;
}

export class TransactionService {
    static async getTransactions(filters: {
        storeId?: string;
        itemId?: string;
        type?: string;
        startDate?: string;
        endDate?: string;
        storeIds?: string[];
        limit?: number;
    }) {
        const where: Prisma.InventoryTransactionWhereInput = {};

        if (filters.storeId) where.storeId = filters.storeId;
        else if (filters.storeIds) where.storeId = { in: filters.storeIds };
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

        const rows = await prisma.inventoryTransaction.findMany({
            where,
            include: {
                store: { select: { name: true, type: true } },
                items: {
                    include: {
                        item: { select: { code: true, name: true, unit: true } }
                    }
                },
            },
            orderBy: { date: 'desc' },
            take: Math.min(Math.max(Math.trunc(filters.limit ?? 1000), 1), 5000),
        });
        const userIds = Array.from(new Set(rows.map((r) => r.userId).filter(Boolean)));
        const users = userIds.length
            ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, username: true } })
            : [];
        const nameById = new Map(users.map((u) => [u.id, u.name || u.username]));
        return rows.map((r) => ({ ...r, user: nameById.has(r.userId) ? { name: nameById.get(r.userId) as string } : undefined }));
    }

    static async saveBalanceSheet(data: {
        contractorId: string;
        storeId: string;
        month: string;
        items: BalanceSheetItemInput[];
        userId: string;
    }) {
        const { contractorId, storeId, month, items, userId } = data;
        await ContractorStoreService.assertForStore(userId, contractorId, storeId);

        if (!contractorId || !storeId || !month || !items) {
            throw AppError.badRequest('MISSING_FIELDS');
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
                
                return await tx.contractorMaterialBalanceSheet.create({
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

        
        const prevSheet = await prisma.contractorMaterialBalanceSheet.findUnique({
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
            
            prevSheet.items.forEach((item) => {
                openingMap.set(item.itemId, Number(item.closingBalance));
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
                receivedMap.set(item.itemId, current + item.quantity.toNumber());
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
                returnedMap.set(item.itemId, current + item.quantity.toNumber());
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
                    usedMap.set(mu.itemId, current + mu.quantity.toNumber());
                } else if (mu.usageType === 'WASTAGE') {
                    const current = wastageMap.get(mu.itemId) || 0;
                    wastageMap.set(mu.itemId, current + mu.quantity.toNumber());
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
                wastageMap.set(item.itemId, current + item.quantity.toNumber());
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

    /**
     * Get Monthly Reconciliation Summary for a Contractor
     * @timeComplexity O(n) where n = total items across all queries (parallel execution)
     */
    static async getReconciliation(params: {
        contractorId: string;
        storeId: string;
        month: string; // "2025-01"
    }) {
        const { contractorId, storeId, month } = params;
        const period = monthPeriod(month);
        if (!period) throw AppError.badRequest('MONTH_REQUIRED: use YYYY-MM');

        // One rule with the contractor screen (ContractorBalanceService): issue notes not rejected, SOD lines that took stock
        // (any finished status: this read only COMPLETED and missed INSTALL_CLOSED), SOD and noted wastage, and the ACCEPTED
        // quantity of returns (this used the requested quantity).
        const rows = await ContractorBalanceService.balance(contractorId, { period, storeId });
        const costs = new Map((await prisma.inventoryItem.findMany({ where: { id: { in: rows.map((r) => r.itemId) } }, select: { id: true, costPrice: true } }))
            .map((i) => [i.id, Number(i.costPrice ?? 0)]));
        return rows
            .filter((r) => r.issued || r.used || r.wastage || r.returned)
            .map((r): MaterialStats => {
                const balance = r.issued - r.used - r.wastage - r.returned;
                const costPrice = costs.get(r.itemId) ?? 0;
                return { id: r.itemId, code: r.itemCode, name: r.itemName, unit: r.unit, issued: r.issued, used: r.used, wastage: r.wastage, returned: r.returned, balance, costPrice, totalValue: balance * costPrice };
            });
    }

    

    /**
     * Generate Monthly Balance Sheet
     */
    static async generateBalanceSheet(contractorId: string, storeId: string, month: string, userId?: string) {
        const stats = await this.getReconciliation({ contractorId, storeId, month });

        // Find previous month's balance sheet for opening balance
        const prevMonthDate = new Date(`${month}-01`);
        prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
        const prevMonthStr = prevMonthDate.toISOString().substring(0, 7);

        const prevSheet = await prisma.contractorMaterialBalanceSheet.findUnique({
            where: {
                contractorId_storeId_month: {
                    contractorId,
                    storeId,
                    month: prevMonthStr
                }
            },
            include: { items: true }
        });

        return await prisma.$transaction(async (tx: TransactionClient) => {
            const sheet = await tx.contractorMaterialBalanceSheet.upsert({
                where: {
                    contractorId_storeId_month: { contractorId, storeId, month }
                },
                update: {},
                create: {
                    contractorId,
                    storeId,
                    month
                }
            });

            // Clear old items if any
            await tx.contractorBalanceSheetItem.deleteMany({
                where: { balanceSheetId: sheet.id }
            });

            // Create new items
            for (const s of stats) {
                const prevItem = prevSheet?.items.find(pi => pi.itemId === s.id);
                const opening = prevItem ? Number(prevItem.closingBalance) : 0;

                await tx.contractorBalanceSheetItem.create({
                    data: {
                        balanceSheetId: sheet.id,
                        itemId: s.id,
                        openingBalance: opening,
                        received: s.issued,
                        returned: s.returned,
                        used: s.used,
                        wastage: s.wastage,
                        closingBalance: opening + s.issued - s.returned - s.used - s.wastage
                    }
                });
            }

            if (userId) {
                await AuditService.log({
                    userId,
                    action: 'GENERATE_BALANCE_SHEET',
                    entity: 'ContractorMaterialBalanceSheet',
                    entityId: sheet.id,
                    newValue: sheet
                });
            }

            return sheet;
        }, { timeout: 30000 });
    }

    /**
     * Get Monthly Balance Sheet with full details
     */
    static async getBalanceSheet(contractorId: string, storeId: string, month: string) {
        return await prisma.contractorMaterialBalanceSheet.findUnique({
            where: {
                contractorId_storeId_month: {
                    contractorId,
                    storeId,
                    month
                }
            },
            include: {
                contractor: {
                    select: {
                        id: true,
                        name: true,
                        registrationNumber: true
                    }
                },
                store: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                items: {
                    include: {
                        item: {
                            select: {
                                id: true,
                                name: true,
                                code: true,
                                unit: true,
                                category: true
                            }
                        }
                    },
                    orderBy: {
                        item: {
                            name: 'asc'
                        }
                    }
                }
            }
        });
    }

    /**
     * Preview balance sheet counts before generation
     */
    static async previewBalanceSheet(contractorId: string, storeId: string, month: string) {
        const [year, monthNum] = month.split('-').map(Number);
        const startDate = new Date(year, monthNum - 1, 1);
        const endDate = new Date(year, monthNum, 0, 23, 59, 59);

        const [issuesCount, returnsCount, usageCount, contractor, store] = await Promise.all([
            prisma.contractorMaterialIssue.count({
                where: {
                    contractorId,
                    storeId,
                    issueDate: { gte: startDate, lte: endDate }
                }
            }),
            prisma.contractorMaterialReturn.count({
                where: {
                    contractorId,
                    storeId,
                    status: 'ACCEPTED',
                    acceptedAt: { gte: startDate, lte: endDate }
                }
            }),
            prisma.sODMaterialUsage.count({
                where: {
                    serviceOrder: {
                        contractorId,
                        completedDate: { gte: startDate, lte: endDate }
                    }
                }
            }),
            prisma.contractor.findUnique({
                where: { id: contractorId },
                select: { id: true, name: true, registrationNumber: true }
            }),
            prisma.inventoryStore.findUnique({
                where: { id: storeId },
                select: { id: true, name: true }
            })
        ]);

        return {
            contractor,
            store,
            month,
            summary: {
                materialIssues: issuesCount,
                materialReturns: returnsCount,
                sodUsage: usageCount,
                hasData: issuesCount > 0 || returnsCount > 0 || usageCount > 0
            }
        };
    }
}