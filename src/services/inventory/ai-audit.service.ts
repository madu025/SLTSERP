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

        for (const sod of completedSods) {
            const usages = sod.materialUsage || [];
            
            // Calculate actual total cost of materials from usage records
            const calculatedCost = usages.reduce((sum, u) => sum + (Number(u.costPrice || 0) * Number(u.quantity || 0)), 0);

            // Fetch Journal Entries for this SOD
            const glEntries = await prisma.journalEntry.findMany({
                where: { referenceId: sod.id, referenceType: 'SOD_CONSUMPTION' },
                include: { lines: true }
            });

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

        for (const sod of returnedSods) {
            // Find consumption postings for this SOD
            const consumptionEntries = await prisma.journalEntry.findMany({
                where: { referenceId: sod.id, referenceType: 'SOD_CONSUMPTION' }
            });

            if (consumptionEntries.length > 0) {
                // There were consumption entries, so there MUST be a reversal entry
                const reversalEntries = await prisma.journalEntry.findMany({
                    where: { referenceId: sod.id, referenceType: 'SOD_CONSUMPTION_REVERSAL' }
                });

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

        for (const stock of contractorStocks) {
            // Calculate sum of issues from store to contractor
            const issues = await prisma.contractorMaterialIssueItem.findMany({
                where: {
                    itemId: stock.itemId,
                    issue: {
                        is: {
                            contractorId: stock.contractorId
                        }
                    }
                }
            });
            const totalIssued = issues.reduce((sum, i) => sum + Number(i.quantity), 0);

            // Calculate sum of usages on completed orders
            const usages = await prisma.sODMaterialUsage.findMany({
                where: {
                    itemId: stock.itemId,
                    serviceOrder: {
                        is: {
                            contractorId: stock.contractorId,
                            sltsStatus: 'COMPLETED'
                        }
                    }
                }
            });
            const totalUsed = usages.reduce((sum, u) => sum + Number(u.quantity), 0);

            // Calculate wastage
            const wastages = await prisma.contractorWastageItem.findMany({
                where: {
                    itemId: stock.itemId,
                    wastage: {
                        is: {
                            contractorId: stock.contractorId,
                            status: 'APPROVED'
                        }
                    }
                }
            });
            const totalWasted = wastages.reduce((sum, w) => sum + Number(w.quantity), 0);

            // Calculate returned
            const returns = await prisma.contractorMaterialReturnItem.findMany({
                where: {
                    itemId: stock.itemId,
                    return: {
                        is: {
                            contractorId: stock.contractorId,
                            status: 'ACCEPTED'
                        }
                    }
                }
            });
            const totalReturned = returns.reduce((sum, r) => sum + Number(r.quantity), 0);

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
