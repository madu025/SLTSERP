import { TransactionClient } from '../inventory/types';

export class LedgerService {
    /**
     * Log double-entry entry for GRN item receipt (Purchase Receipt Accrual)
     * DR: Raw Material Inventory (INV-1010)
     * CR: Accrued Accounts Payable / Inventory Received Uninvoiced (AP-2010)
     */
    static async logGrnReceipt(
        tx: TransactionClient,
        grnId: string,
        totalCost: number,
        description?: string
    ) {
        if (totalCost <= 0) return null;

        const desc = description || `GRN Receipt Entry for GRN ID: ${grnId}`;
        return await tx.journalEntry.create({
            data: {
                referenceId: grnId,
                referenceType: 'GRN',
                description: desc,
                lines: {
                    create: [
                        {
                            accountCode: 'INV-1010',
                            accountName: 'Raw Material Inventory',
                            debit: totalCost,
                            credit: 0,
                            description: 'Inventory received in stores'
                        },
                        {
                            accountCode: 'AP-2010',
                            accountName: 'Accrued Accounts Payable',
                            debit: 0,
                            credit: totalCost,
                            description: 'Accrued inventory uninvoiced'
                        }
                    ]
                }
            }
        });
    }

    /**
     * Log double-entry for SOD Material Consumption (Cost of Goods Sold)
     * DR: Cost of Goods Sold - COGS (COGS-5010)
     * CR: Raw Material Inventory (INV-1010)
     */
    static async logSodConsumption(
        tx: TransactionClient,
        sodId: string,
        totalCost: number,
        description?: string
    ) {
        if (totalCost <= 0) return null;

        const desc = description || `Material Consumption for SOD ID: ${sodId}`;
        return await tx.journalEntry.create({
            data: {
                referenceId: sodId,
                referenceType: 'SOD_CONSUMPTION',
                description: desc,
                lines: {
                    create: [
                        {
                            accountCode: 'COGS-5010',
                            accountName: 'Cost of Goods Sold',
                            debit: totalCost,
                            credit: 0,
                            description: 'Cost of materials installed on service order'
                        },
                        {
                            accountCode: 'INV-1010',
                            accountName: 'Raw Material Inventory',
                            debit: 0,
                            credit: totalCost,
                            description: 'Deduction of materials consumed'
                        }
                    ]
                }
            }
        });
    }

    /**
     * Log double-entry for SOD Accrued Billing Revenue
     * DR: Accrued Invoicing Revenue / Accounts Receivable (AR-1110)
     * CR: Accrued Services Revenue (REV-4010)
     */
    static async logSodRevenue(
        tx: TransactionClient,
        sodId: string,
        revenueAmount: number,
        description?: string
    ) {
        if (revenueAmount <= 0) return null;

        const desc = description || `Accrued Revenue for Completed SOD: ${sodId}`;
        return await tx.journalEntry.create({
            data: {
                referenceId: sodId,
                referenceType: 'SOD_REVENUE',
                description: desc,
                lines: {
                    create: [
                        {
                            accountCode: 'AR-1110',
                            accountName: 'Accrued Invoicing Revenue',
                            debit: revenueAmount,
                            credit: 0,
                            description: 'Accrued billing revenue for completed service connection'
                        },
                        {
                            accountCode: 'REV-4010',
                            accountName: 'Accrued Services Revenue',
                            debit: 0,
                            credit: revenueAmount,
                            description: 'Recognized service revenue'
                        }
                    ]
                }
            }
        });
    }

    /**
     * Log double-entry for Wastage / Scrap Write-Offs
     * DR: Material Wastage Loss / Inventory Write-Offs (EXP-5210)
     * CR: Raw Material Inventory (INV-1010)
     */
    static async logWastage(
        tx: TransactionClient,
        wastageId: string,
        totalCost: number,
        description?: string
    ) {
        if (totalCost <= 0) return null;

        const desc = description || `Material Wastage Write-Off for ID: ${wastageId}`;
        return await tx.journalEntry.create({
            data: {
                referenceId: wastageId,
                referenceType: 'WASTAGE',
                description: desc,
                lines: {
                    create: [
                        {
                            accountCode: 'EXP-5210',
                            accountName: 'Material Wastage Loss',
                            debit: totalCost,
                            credit: 0,
                            description: 'Inventory write-off due to scrap/damage'
                        },
                        {
                            accountCode: 'INV-1010',
                            accountName: 'Raw Material Inventory',
                            debit: 0,
                            credit: totalCost,
                            description: 'Deduction of scrap/damaged materials'
                        }
                    ]
                }
            }
        });
    }

    /**
     * Rollback/Reverse Ledger Entries for returned or cancelled SOD
     * This deletes previous logs or posts Reversing entries (DR REV-4010, CR AR-1110)
     */
    static async rollbackSodTransaction(
        tx: TransactionClient,
        sodId: string,
        description?: string
    ) {
        const desc = description || `Reversal Entry for Cancelled/Returned SOD ID: ${sodId}`;
        
        // Find existing journal entries for this SOD
        const entries = await tx.journalEntry.findMany({
            where: { referenceId: sodId },
            include: { lines: true }
        });

        for (const entry of entries) {
            const reversingLines = entry.lines.map(line => ({
                accountCode: line.accountCode,
                accountName: line.accountName,
                // Reverse Debits and Credits
                debit: line.credit,
                credit: line.debit,
                description: `Reversal: ${line.description || ''}`
            }));

            await tx.journalEntry.create({
                data: {
                    referenceId: sodId,
                    referenceType: `${entry.referenceType}_REVERSAL`,
                    description: `${desc} (Original: ${entry.description})`,
                    lines: {
                        create: reversingLines
                    }
                }
            });
        }
    }
}
