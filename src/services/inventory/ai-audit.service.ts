import { prisma } from '@/lib/prisma';

export interface AuditDiscrepancy {
    type: 'SOD_MATERIAL_MISSING' | 'GL_POSTING_MISMATCH' | 'GL_POSTING_MISSING' | 'REVERSAL_MISSING' | 'STOCK_MISMATCH';
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    entityId: string;
    entityRef: string;
    details: string;
    suggestedFix: string;
}

export class AiAuditService {
    static async runSystemAudit(): Promise<{
        timestamp: Date;
        summary: {
            sodsAudited: number;
            discrepancyCount: number;
            highSeverityCount: number;
        };
        discrepancies: AuditDiscrepancy[];
    }> {
        const discrepancies: AuditDiscrepancy[] = [];
        let sodsAuditedCount = 0;

        // 1. Audit Completed SODs for Material Usages and GL Postings
        const completedSods = await prisma.serviceOrder.findMany({
            where: { sltsStatus: 'COMPLETED' },
            include: {
                materialUsage: true
            }
        });

        sodsAuditedCount = completedSods.length;

        // Batch fetch GL Entries for completed SODs to eliminate N+1 query loop
        const completedSodIds = completedSods.map(s => s.id);
        const allGlEntries = completedSodIds.length > 0 
            ? await prisma.journalEntry.findMany({
                where: {
                    referenceId: { in: completedSodIds },
                    referenceType: 'SOD_CONSUMPTION'
                },
                include: { lines: true }
              })
            : [];

        const glEntriesMap = new Map<string, typeof allGlEntries>();
        for (const entry of allGlEntries) {
            if (entry.referenceId) {
                const list = glEntriesMap.get(entry.referenceId) || [];
                list.push(entry);
                glEntriesMap.set(entry.referenceId, list);
            }
        }

        for (const sod of completedSods) {
            const usages = sod.materialUsage || [];
            
            // Calculate actual total cost of materials from usage records
            const calculatedCost = usages.reduce((sum, u) => sum + (Number(u.costPrice || 0) * Number(u.quantity || 0)), 0);

            // Get pre-fetched GL Entries for this SOD
            const glEntries = glEntriesMap.get(sod.id) || [];

            if (usages.length === 0) {
                // If it's completed but has no usages registered, flag it if the order has revenue or should have materials
                if (Number(sod.revenueAmount || 0) > 0) {
                    discrepancies.push({
                        type: 'SOD_MATERIAL_MISSING',
                        severity: 'MEDIUM',
                        entityId: sod.id,
                        entityRef: sod.soNum,
                        details: `Service order completed with revenue ${sod.revenueAmount} LKR, but has 0 physical material usage records.`,
                        suggestedFix: `Review installation reports and manually record material usages for this order.`
                    });
                }
                continue;
            }

            if (glEntries.length === 0) {
                if (calculatedCost > 0) {
                    discrepancies.push({
                        type: 'GL_POSTING_MISSING',
                        severity: 'HIGH',
                        entityId: sod.id,
                        entityRef: sod.soNum,
                        details: `Material usages are recorded (Value: ${calculatedCost} LKR) but no general ledger posting was found in JournalEntries.`,
                        suggestedFix: `Re-run post-completion ledger synchronization for Service Order ID: ${sod.id}.`
                    });
                }
            } else {
                // Check if GL posting lines match the calculated cost
                const firstEntry = glEntries[0];
                const cogsLine = firstEntry.lines.find(l => l.accountCode === 'COGS-5010');
                const debitVal = cogsLine ? Number(cogsLine.debit) : 0;

                if (Math.abs(debitVal - calculatedCost) > 0.01) {
                    discrepancies.push({
                        type: 'GL_POSTING_MISMATCH',
                        severity: 'HIGH',
                        entityId: sod.id,
                        entityRef: sod.soNum,
                        details: `GL COGS debit value (${debitVal} LKR) does not match calculated material usage cost (${calculatedCost} LKR).`,
                        suggestedFix: `Rollback current ledger entries and re-post correct material consumption cost.`
                    });
                }
            }
        }

        // 2. Audit Returned SODs for Reversal Postings
        const returnedSods = await prisma.serviceOrder.findMany({
            where: { sltsStatus: 'RETURN' }
        });

        // Batch fetch returned SOD entries to eliminate N+1 queries
        const returnedSodIds = returnedSods.map(s => s.id);
        const allReturnedEntries = returnedSodIds.length > 0 
            ? await prisma.journalEntry.findMany({
                where: {
                    referenceId: { in: returnedSodIds },
                    referenceType: { in: ['SOD_CONSUMPTION', 'SOD_CONSUMPTION_REVERSAL'] }
                }
              })
            : [];

        const returnedEntriesMap = new Map<string, { consumption: typeof allReturnedEntries; reversal: typeof allReturnedEntries }>();
        for (const entry of allReturnedEntries) {
            if (entry.referenceId) {
                const key = entry.referenceId;
                const state = returnedEntriesMap.get(key) || { consumption: [], reversal: [] };
                if (entry.referenceType === 'SOD_CONSUMPTION') {
                    state.consumption.push(entry);
                } else if (entry.referenceType === 'SOD_CONSUMPTION_REVERSAL') {
                    state.reversal.push(entry);
                }
                returnedEntriesMap.set(key, state);
            }
        }

        for (const sod of returnedSods) {
            const entries = returnedEntriesMap.get(sod.id) || { consumption: [], reversal: [] };
            const consumptionEntries = entries.consumption;

            if (consumptionEntries.length > 0) {
                // There were consumption entries, so there MUST be a reversal entry
                const reversalEntries = entries.reversal;

                if (reversalEntries.length === 0) {
                    discrepancies.push({
                        type: 'REVERSAL_MISSING',
                        severity: 'HIGH',
                        entityId: sod.id,
                        entityRef: sod.soNum,
                        details: `Service order was returned after completion, but no reversing journal entry was found to rollback consumption costs.`,
                        suggestedFix: `Execute LedgerService.rollbackSodTransaction for Service Order ID: ${sod.id}.`
                    });
                }
            }
        }

        // 3. Audit Contractor Stock levels vs Transaction History
        const contractorStocks = await prisma.contractorStock.findMany({
            include: {
                contractor: true,
                item: true
            }
        });

        const uniqueContractorIds = Array.from(new Set(contractorStocks.map(s => s.contractorId)));
        const uniqueItemIds = Array.from(new Set(contractorStocks.map(s => s.itemId)));

        // Batch fetch issues, usages, wastages, and returns to avoid multiple queries inside loop
        const [allIssues, allUsages, allWastages, allReturns] = await Promise.all([
            uniqueContractorIds.length > 0 && uniqueItemIds.length > 0
                ? prisma.contractorMaterialIssueItem.findMany({
                    where: {
                        itemId: { in: uniqueItemIds },
                        issue: { contractorId: { in: uniqueContractorIds } }
                    },
                    include: { issue: true }
                  })
                : [],
            uniqueContractorIds.length > 0 && uniqueItemIds.length > 0
                ? prisma.sODMaterialUsage.findMany({
                    where: {
                        itemId: { in: uniqueItemIds },
                        serviceOrder: {
                            contractorId: { in: uniqueContractorIds },
                            sltsStatus: 'COMPLETED'
                        }
                    },
                    include: { serviceOrder: true }
                  })
                : [],
            uniqueContractorIds.length > 0 && uniqueItemIds.length > 0
                ? prisma.contractorWastageItem.findMany({
                    where: {
                        itemId: { in: uniqueItemIds },
                        wastage: {
                            contractorId: { in: uniqueContractorIds },
                            status: 'APPROVED'
                        }
                    },
                    include: { wastage: true }
                  })
                : [],
            uniqueContractorIds.length > 0 && uniqueItemIds.length > 0
                ? prisma.contractorMaterialReturnItem.findMany({
                    where: {
                        itemId: { in: uniqueItemIds },
                        return: {
                            contractorId: { in: uniqueContractorIds },
                            status: 'ACCEPTED'
                        }
                    },
                    include: { return: true }
                  })
                : []
        ]);

        const issuesMap = new Map<string, number>();
        for (const issue of allIssues) {
            const key = `${issue.issue.contractorId}_${issue.itemId}`;
            issuesMap.set(key, (issuesMap.get(key) || 0) + Number(issue.quantity));
        }

        const usagesMap = new Map<string, number>();
        for (const usage of allUsages) {
            if (usage.serviceOrder?.contractorId) {
                const key = `${usage.serviceOrder.contractorId}_${usage.itemId}`;
                usagesMap.set(key, (usagesMap.get(key) || 0) + Number(usage.quantity));
            }
        }

        const wastagesMap = new Map<string, number>();
        for (const wastage of allWastages) {
            const key = `${wastage.wastage.contractorId}_${wastage.itemId}`;
            wastagesMap.set(key, (wastagesMap.get(key) || 0) + Number(wastage.quantity));
        }

        const returnsMap = new Map<string, number>();
        for (const r of allReturns) {
            const key = `${r.return.contractorId}_${r.itemId}`;
            returnsMap.set(key, (returnsMap.get(key) || 0) + Number(r.quantity));
        }

        for (const stock of contractorStocks) {
            const key = `${stock.contractorId}_${stock.itemId}`;
            const totalIssued = issuesMap.get(key) || 0;
            const totalUsed = usagesMap.get(key) || 0;
            const totalWasted = wastagesMap.get(key) || 0;
            const totalReturned = returnsMap.get(key) || 0;

            const expectedStock = totalIssued - totalUsed - totalWasted - totalReturned;
            const actualStock = Number(stock.quantity);

            if (Math.abs(actualStock - expectedStock) > 0.001) {
                discrepancies.push({
                    type: 'STOCK_MISMATCH',
                    severity: 'HIGH',
                    entityId: `${stock.contractorId}_${stock.itemId}`,
                    entityRef: `${stock.contractor.name} - ${stock.item.code}`,
                    details: `Current stock count is ${actualStock}, but history-reconciled expected stock is ${expectedStock} (Issued: ${totalIssued}, Used: ${totalUsed}, Wasted: ${totalWasted}, Returned: ${totalReturned}).`,
                    suggestedFix: `Recalculate and re-align stock record or record missing adjustment transaction.`
                });
            }
        }

        return {
            timestamp: new Date(),
            summary: {
                sodsAudited: sodsAuditedCount,
                discrepancyCount: discrepancies.length,
                highSeverityCount: discrepancies.filter(d => d.severity === 'HIGH').length
            },
            discrepancies
        };
    }
}
