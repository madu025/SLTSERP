import { prisma } from '@/lib/prisma';
import { FixedAsset } from '@prisma/client';
import { LedgerService } from './ledger.service';
import { FiscalPeriodService } from './fiscal-period.service';
import { AppError } from '@/lib/error';
import { TransactionClient } from '../inventory/types';

export interface CreateFixedAssetPayload {
    assetNumber?: string;
    name: string;
    category?: string;
    acquisitionDate?: Date;
    cost: number;
    usefulLifeYears?: number;
    depreciationMethod?: string;
    glAssetCode?: string;
    glDepExpCode?: string;
    glAccumDepCode?: string;
}

export interface AssetRegisterSummary {
    totalCost: number;
    totalAccumulatedDepreciation: number;
    totalNetBookValue: number;
    activeCount: number;
    assets: FixedAsset[];
}

export class FixedAssetService {
    /**
     * Create a new Fixed Asset entry in the register.
     */
    static async createAsset(data: CreateFixedAssetPayload): Promise<FixedAsset> {
        if (data.cost <= 0) {
            throw AppError.badRequest('Asset cost must be greater than zero');
        }

        const assetNo = data.assetNumber || `FA-${Date.now().toString().slice(-6)}`;

        const asset = await prisma.fixedAsset.create({
            data: {
                assetNumber: assetNo,
                name: data.name,
                category: data.category || 'EQUIPMENT',
                acquisitionDate: data.acquisitionDate || new Date(),
                cost: data.cost,
                usefulLifeYears: data.usefulLifeYears || 5,
                depreciationMethod: data.depreciationMethod || 'STRAIGHT_LINE',
                glAssetCode: data.glAssetCode || 'FA-1410',
                glDepExpCode: data.glDepExpCode || 'EXP-DEP-6010',
                glAccumDepCode: data.glAccumDepCode || 'ACC-DEP-1510',
                accumulatedDepreciation: 0,
                netBookValue: data.cost,
                status: 'ACTIVE'
            }
        });

        return asset;
    }

    /**
     * Fetch complete Fixed Asset Register with summary totals.
     */
    static async getAssetRegister(): Promise<AssetRegisterSummary> {
        const assets = await prisma.fixedAsset.findMany({
            orderBy: { createdAt: 'desc' }
        });

        let totalCost = 0;
        let totalAccumulatedDepreciation = 0;
        let totalNetBookValue = 0;
        let activeCount = 0;

        for (const a of assets) {
            totalCost += Number(a.cost);
            totalAccumulatedDepreciation += Number(a.accumulatedDepreciation);
            totalNetBookValue += Number(a.netBookValue);
            if (a.status === 'ACTIVE') activeCount++;
        }

        return {
            totalCost,
            totalAccumulatedDepreciation,
            totalNetBookValue,
            activeCount,
            assets
        };
    }

    /**
     * Execute monthly Straight-Line Depreciation run across all active fixed assets.
     * Big-O Optimization: Uses O(1) Set lookup with batch query to eliminate N+1 DB queries in loops.
     */
    static async runMonthlyDepreciation(tx: TransactionClient, year: number, month: number, createdById?: string) {
        // Enforce period lock assertion
        const postingDate = new Date(year, month - 1, 28);
        await FiscalPeriodService.assertPeriodOpen(tx, postingDate);

        const activeAssets = await tx.fixedAsset.findMany({
            where: { status: 'ACTIVE' }
        });

        if (activeAssets.length === 0) {
            return { year, month, batchDepreciationTotal: 0, logsCount: 0 };
        }

        // Batch fetch existing logs for this period to eliminate N+1 DB queries
        const existingLogs = await tx.depreciationLog.findMany({
            where: {
                year,
                month,
                fixedAssetId: { in: activeAssets.map((a: { id: string }) => a.id) }
            },
            select: { fixedAssetId: true }
        });
        const existingLogSet = new Set<string>(existingLogs.map((l: { fixedAssetId: string }) => l.fixedAssetId));

        let batchDepreciationTotal = 0;
        const logsCreated = [];

        for (const asset of activeAssets) {
            // O(1) Set lookup to prevent double-depreciation
            if (existingLogSet.has(asset.id)) continue;

            // Straight line monthly charge: Cost / (usefulLifeYears * 12)
            const annualCharge = Number(asset.cost) / asset.usefulLifeYears;
            let monthlyCharge = Number((annualCharge / 12).toFixed(2));

            // Cap monthly charge to remaining depreciable cost
            const remainingDepreciable = Number(asset.cost) - Number(asset.accumulatedDepreciation);
            if (remainingDepreciable <= 0) {
                await tx.fixedAsset.update({
                    where: { id: asset.id },
                    data: { status: 'FULLY_DEPRECIATED', netBookValue: 0 }
                });
                continue;
            }

            if (monthlyCharge > remainingDepreciable) {
                monthlyCharge = remainingDepreciable;
            }

            const newAccumulated = Number(asset.accumulatedDepreciation) + monthlyCharge;
            const newNbv = Math.max(0, Number(asset.cost) - newAccumulated);
            const isFullyDep = newNbv === 0;

            // Update Fixed Asset record
            await tx.fixedAsset.update({
                where: { id: asset.id },
                data: {
                    accumulatedDepreciation: newAccumulated,
                    netBookValue: newNbv,
                    status: isFullyDep ? 'FULLY_DEPRECIATED' : 'ACTIVE'
                }
            });

            // Create Depreciation Log
            const log = await tx.depreciationLog.create({
                data: {
                    fixedAssetId: asset.id,
                    year,
                    month,
                    depreciationAmount: monthlyCharge,
                    accumulatedAfter: newAccumulated,
                    netBookValueAfter: newNbv
                }
            });

            batchDepreciationTotal += monthlyCharge;
            logsCreated.push(log);
        }

        // Post batch GL double-entry journal if depreciation occurred
        if (batchDepreciationTotal > 0) {
            await LedgerService.postTransaction(tx, {
                referenceId: `DEP-${year}-${month}`,
                referenceType: 'FIXED_ASSET_DEPRECIATION',
                description: `Monthly Fixed Asset Depreciation Run for ${year}-${String(month).padStart(2, '0')}`,
                date: postingDate,
                createdById,
                lines: [
                    {
                        accountCode: 'EXP-DEP-6010',
                        debit: batchDepreciationTotal,
                        credit: 0,
                        description: `Depreciation Expense for ${year}-${month}`
                    },
                    {
                        accountCode: 'ACC-DEP-1510',
                        debit: 0,
                        credit: batchDepreciationTotal,
                        description: `Accumulated Depreciation for ${year}-${month}`
                    }
                ]
            });
        }

        return {
            year,
            month,
            batchDepreciationTotal,
            logsCount: logsCreated.length
        };
    }
}
