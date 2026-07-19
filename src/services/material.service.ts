import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { AuditService } from './audit.service';
import { InventoryService } from './inventory.service';
import { TransactionClient } from './inventory/types';

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

export class MaterialService {

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
                s.issued += ii.quantity;
            });
        });

        // Add Usage
        sodUsage.forEach(usage => {
            const s = getItem(usage.item);
            if (usage.usageType === 'WASTAGE') {
                s.wastage += usage.quantity;
            } else {
                s.used += usage.quantity;
            }
        });

        // Add Returns
        returns.forEach(ret => {
            ret.items.forEach(ri => {
                const s = getItem(ri.item);
                s.returned += ri.quantity;
            });
        });

        // Add Direct Wastage
        wastages.forEach(w => {
            w.items.forEach(wi => {
                const s = getItem(wi.item);
                s.wastage += wi.quantity;
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
     * Issue Materials to Contractor
     */
    static async issueMaterials(data: {
        contractorId: string;
        storeId: string;
        month: string;
        items: { itemId: string; quantity: number; unit: string }[];
        issuedBy?: string;
    }, userId?: string) {
        return await prisma.$transaction(async (tx: TransactionClient) => {
            // 1. Create Issue Record
            const issue = await tx.contractorMaterialIssue.create({
                data: {
                    contractorId: data.contractorId,
                    storeId: data.storeId,
                    month: data.month,
                    issuedBy: data.issuedBy,
                    items: {
                        create: data.items.map(i => ({
                            itemId: i.itemId,
                            quantity: i.quantity,
                            unit: i.unit
                        }))
                    }
                }
            });

            // 2. FIFO Stock Deduction & Batch Transfer
            for (const item of data.items) {
                // A. Pick Batches using FIFO
                const pickedBatches = await InventoryService.pickStoreBatchesFIFO(tx, data.storeId, item.itemId, item.quantity);

                for (const picked of pickedBatches) {
                    if (!picked.batchId) continue;
                    // Reduce from Store Batch Stock
                    await tx.inventoryBatchStock.update({
                        where: { storeId_batchId: { storeId: data.storeId, batchId: picked.batchId } },
                        data: { quantity: { decrement: picked.quantity } }
                    });

                    // Add to Contractor Batch Stock
                    await tx.contractorBatchStock.upsert({
                        where: { contractorId_batchId: { contractorId: data.contractorId, batchId: picked.batchId } },
                        update: { quantity: { increment: picked.quantity } },
                        create: {
                            contractorId: data.contractorId,
                            batchId: picked.batchId,
                            itemId: item.itemId,
                            quantity: picked.quantity
                        }
                    });
                }

                // B. Update Global Contractor Stock
                await tx.contractorStock.upsert({
                    where: { contractorId_itemId: { contractorId: data.contractorId, itemId: item.itemId } },
                    update: { quantity: { increment: item.quantity } },
                    create: { contractorId: data.contractorId, itemId: item.itemId, quantity: item.quantity }
                });

                // C. Deduct from Global Store Stock
                await tx.inventoryStock.update({
                    where: { storeId_itemId: { storeId: data.storeId, itemId: item.itemId } },
                    data: { quantity: { decrement: item.quantity } }
                });
            }

            if (userId) {
                await AuditService.log({
                    userId,
                    action: 'ISSUE_MATERIALS',
                    entity: 'ContractorMaterialIssue',
                    entityId: issue.id,
                    newValue: issue
                });
            }

            return issue;
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
                const opening = prevItem ? prevItem.closingBalance : 0;

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
