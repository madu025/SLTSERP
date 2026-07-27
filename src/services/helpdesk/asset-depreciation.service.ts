import { prisma } from '@/lib/prisma';
import { LedgerService, PostTransactionInput } from '@/services/finance/ledger.service';
import { ACCOUNTS } from '@/services/finance/account-codes';
import { ITAssetStatus } from '@prisma/client';
import { AppError } from '@/lib/error';

export class ITAssetDepreciationService {
    /**
     * Runs monthly via cron to compute depreciation and post GL entries.
     * Convention: Full-month convention (assumes depreciation starts on 1st of month).
     */
    static async postMonthlyDepreciation(period: string, userId: string): Promise<{ processed: number, totalDepreciation: number }> {
        // Find all active/spare assets that have a purchase cost
        // and purchase cost is >= 500 (CapEx threshold)
        const assets = await prisma.iTAsset.findMany({
            where: {
                status: {
                    in: [ITAssetStatus.ACTIVE, ITAssetStatus.SPARE, ITAssetStatus.UNDER_REPAIR]
                },
                purchaseCost: {
                    gte: 500
                },
                purchaseDate: {
                    not: null
                }
            }
        });

        if (assets.length === 0) {
            return { processed: 0, totalDepreciation: 0 };
        }

        let totalDepreciation = 0;
        
        // Typical Useful Life for IT Assets is 3 years (36 months)
        const USEFUL_LIFE_MONTHS = 36;
        const SALVAGE_VALUE_PERCENT = 0.10; // 10% salvage value

        for (const asset of assets) {
            if (!asset.purchaseCost) continue;
            
            const salvageValue = asset.purchaseCost * SALVAGE_VALUE_PERCENT;
            const depreciableBase = asset.purchaseCost - salvageValue;
            
            // Monthly depreciation = depreciable base / useful life
            const monthlyDepreciation = depreciableBase / USEFUL_LIFE_MONTHS;
            
            totalDepreciation += monthlyDepreciation;
        }
        
        if (totalDepreciation <= 0) {
            return { processed: 0, totalDepreciation: 0 };
        }

        // Prepare the JV
        const jvInput: PostTransactionInput = {
            date: new Date(),
            referenceId: `DEPR-IT-${period}`,
            referenceType: 'DEPRECIATION',
            description: `Monthly Depreciation for IT Assets - ${period}`,
            createdById: userId,
            lines: [
                {
                    accountCode: ACCOUNTS.DEPRECIATION_EXPENSE,
                    debit: totalDepreciation,
                    credit: 0,
                    description: 'IT Asset Monthly Depreciation Expense'
                },
                {
                    accountCode: ACCOUNTS.ACCUM_DEPRECIATION,
                    debit: 0,
                    credit: totalDepreciation,
                    description: 'Accumulated Depreciation - IT Assets'
                }
            ]
        };

        // Post the JV using the Ledger Service
        await LedgerService.postTransaction(prisma, jvInput);
        
        return {
            processed: assets.length,
            totalDepreciation
        };
    }
}
