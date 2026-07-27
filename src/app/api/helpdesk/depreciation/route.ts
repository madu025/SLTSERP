import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ITAssetStatus } from '@prisma/client';
import { ITAssetDepreciationService } from '@/services/helpdesk/asset-depreciation.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async () => {
    // Useful life constant for IT CapEx assets (3 years = 36 months)
    const USEFUL_LIFE_MONTHS = 36;
    const SALVAGE_VALUE_PERCENT = 0.10;

    const assets = await prisma.iTAsset.findMany({
        where: {
            purchaseCost: { gte: 1 },
            purchaseDate: { not: null }
        },
        select: {
            id: true,
            assetNumber: true,
            serialNumber: true,
            brand: true,
            model: true,
            deviceType: true,
            purchaseDate: true,
            purchaseCost: true,
            status: true
        },
        orderBy: { purchaseDate: 'desc' }
    });

    const now = new Date();

    const formattedAssets = assets.map((asset) => {
        const cost = asset.purchaseCost || 0;
        const purchaseDate = asset.purchaseDate ? new Date(asset.purchaseDate) : now;
        
        // Calculate age in months
        const monthsInUse = Math.max(
            0,
            (now.getFullYear() - purchaseDate.getFullYear()) * 12 + (now.getMonth() - purchaseDate.getMonth())
        );

        const salvageValue = cost * SALVAGE_VALUE_PERCENT;
        const depreciableBase = cost - salvageValue;
        const monthlyDepreciation = depreciableBase / USEFUL_LIFE_MONTHS;
        
        const accumulatedDepreciation = Math.min(depreciableBase, monthlyDepreciation * monthsInUse);
        const netBookValue = Math.max(salvageValue, cost - accumulatedDepreciation);

        return {
            ...asset,
            assetTag: asset.assetNumber,
            deviceName: `${asset.brand} ${asset.model}`,
            purchaseCost: cost,
            usefulLifeMonths: USEFUL_LIFE_MONTHS,
            monthsInUse,
            salvageValue,
            monthlyDepreciation,
            accumulatedDepreciation,
            netBookValue
        };
    });

    const totalCost = formattedAssets.reduce((sum, a) => sum + a.purchaseCost, 0);
    const totalAccumulated = formattedAssets.reduce((sum, a) => sum + a.accumulatedDepreciation, 0);
    const totalNetBookValue = formattedAssets.reduce((sum, a) => sum + a.netBookValue, 0);
    const estMonthlyPosting = formattedAssets
        .filter(a => a.status === ITAssetStatus.ACTIVE || a.status === ITAssetStatus.SPARE)
        .reduce((sum, a) => sum + a.monthlyDepreciation, 0);

    return {
        assets: formattedAssets,
        summary: {
            totalAssetCount: formattedAssets.length,
            totalCost,
            totalAccumulated,
            totalNetBookValue,
            estMonthlyPosting
        }
    };
});

export const POST = apiHandler(async (req: Request) => {
    const userId = req.headers.get('x-user-id');
    if (!userId) {
        throw AppError.unauthorized('Authentication required');
    }

    const body = await req.json().catch(() => ({}));
    const schema = z.object({
        period: z.string().optional()
    });

    const parsed = schema.parse(body);
    const period = parsed.period || new Date().toISOString().substring(0, 7);

    const result = await ITAssetDepreciationService.postMonthlyDepreciation(period, userId);

    return {
        success: true,
        period,
        ...result
    };
});
