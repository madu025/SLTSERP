import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { TransactionClient } from './types';
import { AuditService } from '@/services/audit/audit.service';
import { InventoryService } from '@/services/inventory/inventory.service';

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

        // Calculate month boundaries
        const monthStart = new Date(`${month}-01`);
        const monthEnd = new Date(monthStart);
        monthEnd.setMonth(monthEnd.getMonth() + 1);

        // O(1) parallel queries - Execute all 4 DB queries concurrently instead of sequentially
        const [issues, sodUsage, returns, wastages] = await Promise.all([
            // 1. Fetch Issues
            prisma.contractorMaterialIssue.findMany({
                where: { contractorId, storeId, month },
                select: {
                    id: true,
                    items: {
                        select: {
                            quantity: true,
                            item: {
                                select: { id: true, code: true, name: true, unit: true }
                            }
                        }
                    }
                }
            }),
            // 2. Fetch Usage from SODs (COMPLETED only - RETURN'd SODs have materialUsage deleted on rollback)
            prisma.sODMaterialUsage.findMany({
                where: {
                    serviceOrder: {
                        contractorId,
                        opmc: { storeId },
                        sltsStatus: 'COMPLETED',
                        completedDate: {
                            gte: monthStart,
                            lt: monthEnd
                        }
                    }
                },
                select: {
                    quantity: true,
                    usageType: true,
                    item: {
                        select: { id: true, code: true, name: true, unit: true }
                    }
                }
            }),
            // 3. Fetch Returns
            prisma.contractorMaterialReturn.findMany({
                where: { contractorId, storeId, month, status: 'ACCEPTED' },
                select: {
                    items: {
                        select: {
                            quantity: true,
                            item: {
                                select: { id: true, code: true, name: true, unit: true }
                            }
                        }
                    }
                }
            }),
            // 4. Fetch Direct Wastage (Reported)
            prisma.contractorWastage.findMany({
                where: {
                    contractorId,
                    storeId,
                    month,
                    status: 'APPROVED'
                },
                select: {
                    items: {
                        select: {
                            quantity: true,
                            item: {
                                select: { id: true, code: true, name: true, unit: true }
                            }
                        }
                    }
                }
            })
        ]);

        // 4. Aggregate by Item
        const itemStats: Record<string, MaterialStats> = {};

        // Helper to get/init item
        const getItem = (item: { id: string, code: string, name: string, unit: string, costPrice?: number }) => {
            if (!itemStats[item.id]) {
                itemStats[item.id] = {
                    id: item.id,
                    code: item.code,
                    name: item.name,
                    unit: item.unit,
                    issued: 0,
                    used: 0,
                    wastage: 0,
                    returned: 0,
                    balance: 0,
                    costPrice: item.costPrice || 0,
                    totalValue: 0
                };
            }
            return itemStats[item.id];
        };

        // Add Issues
        issues.forEach(issue => {
            issue.items.forEach(ii => {
                const s = getItem(ii.item);
                s.issued += Number(ii.quantity);
            });
        });

        // Add Usage
        sodUsage.forEach(usage => {
            const s = getItem(usage.item);
            if (usage.usageType === 'WASTAGE') {
                s.wastage += Number(usage.quantity);
            } else {
                s.used += Number(usage.quantity);
            }
        });

        // Add Returns
        returns.forEach(ret => {
            ret.items.forEach(ri => {
                const s = getItem(ri.item);
                s.returned += Number(ri.quantity);
            });
        });

        // Add Direct Wastage
        wastages.forEach(w => {
            w.items.forEach(wi => {
                const s = getItem(wi.item);
                s.wastage += Number(wi.quantity);
            });
        });

        // Calculate Logic
        Object.values(itemStats).forEach((s) => {
            s.balance = s.issued - s.used - s.wastage - s.returned;
            s.totalValue = s.balance * s.costPrice;
        });

        return Object.values(itemStats);
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