import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError, ApiError } from '@/lib/api-utils';

// GET - Fetch all Contractor Payment configurations
export async function GET(req: NextRequest) {
    try {
        const role = req.headers.get('x-user-role');

        if (!['SUPER_ADMIN', 'ADMIN', 'OSP_MANAGER'].includes(role || '')) {
            throw new ApiError('Forbidden', 403);
        }

        const configs = await (prisma as any).contractorPaymentConfig.findMany({
            include: {
                rtom: {
                    select: {
                        id: true,
                        rtom: true,
                        name: true
                    }
                },
                tiers: true
            },
            orderBy: [
                { rtomId: 'asc' },
                { createdAt: 'desc' }
            ]
        });

        return NextResponse.json({ success: true, data: configs });
    } catch (error) {
        return handleApiError(error);
    }
}

// POST - Create new Contractor Payment configuration
export async function POST(req: NextRequest) {
    try {
        const role = req.headers.get('x-user-role');
        const userId = req.headers.get('x-user-id');

        if (!['SUPER_ADMIN', 'ADMIN'].includes(role || '')) {
            throw new ApiError('Forbidden', 403);
        }

        const body = await req.json();
        const { rtomId, tiers, notes } = body;

        if (!tiers || !Array.isArray(tiers) || tiers.length === 0) {
            throw new ApiError('Pricing tiers are required', 400);
        }

        const config = await (prisma as any).contractorPaymentConfig.create({
            data: {
                rtomId: rtomId || null,
                notes,
                createdBy: userId || undefined,
                tiers: {
                    create: tiers.map((t: any) => ({
                        minDistance: parseFloat(t.minDistance),
                        maxDistance: parseFloat(t.maxDistance),
                        amount: parseFloat(t.amount)
                    }))
                }
            },
            include: {
                rtom: {
                    select: {
                        id: true,
                        rtom: true,
                        name: true
                    }
                },
                tiers: true
            }
        });

        return NextResponse.json({ success: true, data: config });
    } catch (error) {
        return handleApiError(error);
    }
}

// PUT - Update Contractor Payment configuration
export async function PUT(req: NextRequest) {
    try {
        const role = req.headers.get('x-user-role');

        if (!['SUPER_ADMIN', 'ADMIN'].includes(role || '')) {
            throw new ApiError('Forbidden', 403);
        }

        const body = await req.json();
        const { id, rtomId, tiers, notes, isActive } = body;

        if (!id) {
            throw new ApiError('Configuration ID required', 400);
        }

        // Using a transaction to delete old tiers and create new ones
        const config = await (prisma as any).$transaction(async (tx: any) => {
            // Delete existing tiers
            await tx.contractorPaymentTier.deleteMany({
                where: { configId: id }
            });

            // Update main config
            return await tx.contractorPaymentConfig.update({
                where: { id },
                data: {
                    rtomId: rtomId !== undefined ? (rtomId || null) : undefined,
                    notes: notes !== undefined ? notes : undefined,
                    isActive: isActive !== undefined ? isActive : undefined,
                    tiers: {
                        create: tiers.map((t: any) => ({
                            minDistance: parseFloat(t.minDistance),
                            maxDistance: parseFloat(t.maxDistance),
                            amount: parseFloat(t.amount)
                        }))
                    }
                },
                include: {
                    rtom: {
                        select: {
                            id: true,
                            rtom: true,
                            name: true
                        }
                    },
                    tiers: true
                }
            });
        });

        return NextResponse.json({ success: true, data: config });
    } catch (error) {
        return handleApiError(error);
    }
}

// DELETE - Delete Contractor Payment configuration
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

        await (prisma as any).contractorPaymentConfig.delete({
            where: { id }
        });

        return NextResponse.json({ success: true, message: 'Configuration deleted successfully' });
    } catch (error) {
        return handleApiError(error);
    }
}
