import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError, ApiError } from '@/lib/api-utils';

// GET - Calculate revenue for a specific SOD or date
export async function GET(req: NextRequest) {
    try {
        const role = req.headers.get('x-user-role');

        if (!role) {
            throw new ApiError('Unauthorized', 401);
        }

        const { searchParams } = new URL(req.url);
        const rtomId = searchParams.get('rtomId');
        const date = searchParams.get('date');

        if (!rtomId || !date) {
            throw new ApiError('RTOM ID and date are required', 400);
        }

        const completedDate = new Date(date);
        const revenue = await getRevenueForSOD(rtomId, completedDate);

        return NextResponse.json({
            success: true,
            data: {
                revenue,
                rtomId,
                date: completedDate.toISOString()
            }
        });
    } catch (error) {
        return handleApiError(error);
    }
}

// Utility function to get revenue for a specific SOD
export async function getRevenueForSOD(
    rtomId: string,
    completedDate: Date
): Promise<number> {

    // Step 1: Check for RTOM-specific rate with date range
    const rtomWithDate = await prisma.sODRevenueConfig.findFirst({
        where: {
            rtomId: rtomId,
            effectiveFrom: { lte: completedDate },
            effectiveTo: { gte: completedDate },
            isActive: true
        },
        orderBy: { createdAt: 'desc' }
    });
    if (rtomWithDate) return rtomWithDate.revenuePerSOD;

    // Step 2: Check for RTOM-specific rate (permanent)
    const rtomPermanent = await prisma.sODRevenueConfig.findFirst({
        where: {
            rtomId: rtomId,
            effectiveFrom: null,
            effectiveTo: null,
            isActive: true
        },
        orderBy: { createdAt: 'desc' }
    });
    if (rtomPermanent) return rtomPermanent.revenuePerSOD;

    // Step 3: Get default rate
    const defaultRate = await prisma.sODRevenueConfig.findFirst({
        where: {
            rtomId: null, // Default for all RTOMs
            isActive: true
        },
        orderBy: { createdAt: 'desc' }
    });

    return defaultRate?.revenuePerSOD || 10500; // Fallback to Rs. 10,500
}
