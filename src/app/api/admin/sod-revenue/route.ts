import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError, ApiError } from '@/lib/api-utils';

// GET - Fetch all SOD revenue configurations
export async function GET(req: NextRequest) {
    try {
        const role = req.headers.get('x-user-role');

        if (!['SUPER_ADMIN', 'ADMIN', 'OSP_MANAGER'].includes(role || '')) {
            throw new ApiError('Forbidden', 403);
        }

        const configs = await prisma.sODRevenueConfig.findMany({
            include: {
                rtom: {
                    select: {
                        id: true,
                        rtom: true,
                        name: true
                    }
                }
            },
            orderBy: [
                { rtomId: 'asc' },
                { effectiveFrom: 'desc' }
            ]
        });

        return NextResponse.json({ success: true, data: configs });
    } catch (error) {
        return handleApiError(error);
    }
}

// POST - Create new SOD revenue configuration
export async function POST(req: NextRequest) {
    try {
        const role = req.headers.get('x-user-role');
        const userId = req.headers.get('x-user-id');

        if (!['SUPER_ADMIN', 'ADMIN'].includes(role || '')) {
            throw new ApiError('Forbidden', 403);
        }

        const body = await req.json();
        const { rtomId, revenuePerSOD, effectiveFrom, effectiveTo, circularRef, notes } = body;

        if (!revenuePerSOD || revenuePerSOD <= 0) {
            throw new ApiError('Invalid revenue amount', 400);
        }

        // Validate date range if provided
        if (effectiveFrom && effectiveTo) {
            const from = new Date(effectiveFrom);
            const to = new Date(effectiveTo);
            if (from >= to) {
                throw new ApiError('Invalid date range', 400);
            }
        }

        const config = await prisma.sODRevenueConfig.create({
            data: {
                rtomId: rtomId || null,
                revenuePerSOD: parseFloat(revenuePerSOD),
                effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : null,
                effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
                circularRef,
                notes,
                createdBy: userId || undefined
            },
            include: {
                rtom: {
                    select: {
                        id: true,
                        rtom: true,
                        name: true
                    }
                }
            }
        });

        return NextResponse.json({ success: true, data: config });
    } catch (error) {
        return handleApiError(error);
    }
}

// PUT - Update SOD revenue configuration
export async function PUT(req: NextRequest) {
    try {
        const role = req.headers.get('x-user-role');

        if (!['SUPER_ADMIN', 'ADMIN'].includes(role || '')) {
            throw new ApiError('Forbidden', 403);
        }

        const body = await req.json();
        const { id, revenuePerSOD, effectiveFrom, effectiveTo, circularRef, notes, isActive } = body;

        if (!id) {
            throw new ApiError('Configuration ID required', 400);
        }

        const updateData: any = {};
        if (revenuePerSOD !== undefined) updateData.revenuePerSOD = parseFloat(revenuePerSOD);
        if (effectiveFrom !== undefined) updateData.effectiveFrom = effectiveFrom ? new Date(effectiveFrom) : null;
        if (effectiveTo !== undefined) updateData.effectiveTo = effectiveTo ? new Date(effectiveTo) : null;
        if (circularRef !== undefined) updateData.circularRef = circularRef;
        if (notes !== undefined) updateData.notes = notes;
        if (isActive !== undefined) updateData.isActive = isActive;

        const config = await prisma.sODRevenueConfig.update({
            where: { id },
            data: updateData,
            include: {
                rtom: {
                    select: {
                        id: true,
                        rtom: true,
                        name: true
                    }
                }
            }
        });

        return NextResponse.json({ success: true, data: config });
    } catch (error) {
        return handleApiError(error);
    }
}

// DELETE - Delete SOD revenue configuration
export async function DELETE(req: NextRequest) {
    try {
        const role = req.headers.get('x-user-role');

        if (!['SUPER_ADMIN', 'ADMIN'].includes(role || '')) {
            throw new ApiError('Forbidden', 403);
        }

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            throw new ApiError('Configuration ID required', 400);
        }

        await prisma.sODRevenueConfig.delete({
            where: { id }
        });

        return NextResponse.json({ success: true, message: 'Configuration deleted successfully' });
    } catch (error) {
        return handleApiError(error);
    }
}
