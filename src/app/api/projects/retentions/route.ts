import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/projects/retentions?projectId=xxx - List retentions by project
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        if (!projectId) {
            return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
        }

        const retentions = await prisma.projectRetention.findMany({
            where: { projectId },
            include: {
                releases: { orderBy: { releaseDate: 'desc' } },
                invoice: {
                    select: { invoiceNumber: true, title: true, totalAmount: true }
                }
            },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json(retentions);
    } catch (error: any) {
        console.error('Error fetching retentions:', error);
        return NextResponse.json({ error: 'Failed to fetch retentions' }, { status: 500 });
    }
}

// POST /api/projects/retentions - Create a new retention entry
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            projectId, invoiceId, title, description, retentionPercent,
            retentionAmount, releaseCondition, defectLiabilityPeriod,
        } = body;

        if (!projectId || !title || !retentionAmount) {
            return NextResponse.json(
                { error: 'projectId, title, and retentionAmount are required' },
                { status: 400 }
            );
        }

        const retention = await prisma.projectRetention.create({
            data: {
                projectId,
                invoiceId: invoiceId || null,
                title,
                description: description || null,
                retentionPercent: retentionPercent || 10,
                retentionAmount,
                releasedAmount: 0,
                balanceAmount: retentionAmount,
                releaseCondition: releaseCondition || null,
                defectLiabilityPeriod: defectLiabilityPeriod || null,
                defectLiabilityEnd: defectLiabilityPeriod
                    ? new Date(Date.now() + (defectLiabilityPeriod * 24 * 60 * 60 * 1000))
                    : null,
                status: 'HELD',
            },
            include: { releases: true },
        });

        return NextResponse.json(retention, { status: 201 });
    } catch (error: any) {
        console.error('Error creating retention:', error);
        return NextResponse.json({ error: 'Failed to create retention' }, { status: 500 });
    }
}

// PATCH /api/projects/retentions - Release retention or update
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            id, action, releaseAmount, releaseDate, approvedById, remarks,
        } = body;

        if (!id || !action) {
            return NextResponse.json({ error: 'id and action are required' }, { status: 400 });
        }

        const existing = await prisma.projectRetention.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json({ error: 'Retention not found' }, { status: 404 });
        }

        if (action === 'RELEASE') {
            if (!releaseAmount) {
                return NextResponse.json({ error: 'releaseAmount is required' }, { status: 400 });
            }

            if (releaseAmount > existing.balanceAmount) {
                return NextResponse.json(
                    { error: `Release amount cannot exceed balance of ${existing.balanceAmount}` },
                    { status: 400 }
                );
            }

            const newReleased = (existing.releasedAmount || 0) + releaseAmount;
            const newBalance = existing.retentionAmount - newReleased;
            const newStatus = newBalance <= 0 ? 'FULLY_RELEASED' : 'PARTIALLY_RELEASED';

            // Use transaction to create release and update retention
            const retention = await prisma.$transaction(async (tx) => {
                await tx.retentionRelease.create({
                    data: {
                        retentionId: id,
                        releaseAmount,
                        releaseDate: releaseDate ? new Date(releaseDate) : new Date(),
                        approvedById: approvedById || null,
                        approvedAt: new Date(),
                        remarks: remarks || null,
                    },
                });

                return tx.projectRetention.update({
                    where: { id },
                    data: {
                        releasedAmount: newReleased,
                        balanceAmount: newBalance,
                        status: newStatus,
                    },
                    include: { releases: { orderBy: { releaseDate: 'desc' } } },
                });
            });

            return NextResponse.json(retention);
        }

        if (action === 'UPDATE') {
            const updateData: any = {};
            if (body.retentionPercent) updateData.retentionPercent = body.retentionPercent;
            if (body.retentionAmount) {
                updateData.retentionAmount = body.retentionAmount;
                updateData.balanceAmount = body.retentionAmount - existing.releasedAmount;
            }
            if (body.status) updateData.status = body.status;
            if (body.releaseCondition) updateData.releaseCondition = body.releaseCondition;
            if (body.defectLiabilityPeriod) {
                updateData.defectLiabilityPeriod = body.defectLiabilityPeriod;
                updateData.defectLiabilityEnd = new Date(Date.now() + (body.defectLiabilityPeriod * 24 * 60 * 60 * 1000));
            }

            const retention = await prisma.projectRetention.update({
                where: { id },
                data: updateData,
                include: { releases: { orderBy: { releaseDate: 'desc' } } },
            });

            return NextResponse.json(retention);
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: any) {
        console.error('Error updating retention:', error);
        return NextResponse.json({ error: 'Failed to update retention' }, { status: 500 });
    }
}

// DELETE /api/projects/retentions - Delete
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }

        const existing = await prisma.projectRetention.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json({ error: 'Retention not found' }, { status: 404 });
        }

        if (existing.releasedAmount > 0) {
            return NextResponse.json(
                { error: 'Cannot delete retention with releases' },
                { status: 400 }
            );
        }

        await prisma.projectRetention.delete({ where: { id } });
        return NextResponse.json({ message: 'Retention deleted successfully' });
    } catch (error: any) {
        console.error('Error deleting retention:', error);
        return NextResponse.json({ error: 'Failed to delete retention' }, { status: 500 });
    }
}
