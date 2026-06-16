import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/projects/ld-penalties?projectId=xxx - List LD/Penalties by project
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        if (!projectId) {
            return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
        }

        const penalties = await prisma.projectLDPenalty.findMany({
            where: { projectId },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json(penalties);
    } catch (error: any) {
        console.error('Error fetching LD/penalties:', error);
        return NextResponse.json({ error: 'Failed to fetch LD/penalties' }, { status: 500 });
    }
}

// POST /api/projects/ld-penalties - Create a new LD/Penalty
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            projectId, title, description, type, category, amount,
            percentage, referenceTable, referenceId, referenceDesc,
            appliedDate, leviedById, remarks,
        } = body;

        if (!projectId || !title || !amount) {
            return NextResponse.json(
                { error: 'projectId, title, and amount are required' },
                { status: 400 }
            );
        }

        const penalty = await prisma.projectLDPenalty.create({
            data: {
                projectId,
                title,
                description: description || null,
                type: type || 'LD',
                category: category || 'DELAY',
                amount,
                percentage: percentage || null,
                referenceTable: referenceTable || null,
                referenceId: referenceId || null,
                referenceDesc: referenceDesc || null,
                waivedAmount: 0,
                netAmount: amount,
                appliedDate: appliedDate ? new Date(appliedDate) : new Date(),
                leviedById: leviedById || null,
                remarks: remarks || null,
                status: 'PROPOSED',
            },
        });

        return NextResponse.json(penalty, { status: 201 });
    } catch (error: any) {
        console.error('Error creating LD/penalty:', error);
        return NextResponse.json({ error: 'Failed to create LD/penalty' }, { status: 500 });
    }
}

// PATCH /api/projects/ld-penalties - Update LD/Penalty status
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            id, status, approvedById, waivedAmount, remarks,
        } = body;

        if (!id || !status) {
            return NextResponse.json({ error: 'id and status are required' }, { status: 400 });
        }

        const existing = await prisma.projectLDPenalty.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json({ error: 'LD/penalty not found' }, { status: 404 });
        }

        const updateData: any = { status };

        if (status === 'APPROVED' || status === 'WAIVED') {
            updateData.approvedById = approvedById || null;
            updateData.approvedAt = new Date();
        }

        if (waivedAmount !== undefined) {
            updateData.waivedAmount = waivedAmount;
            updateData.netAmount = existing.amount - waivedAmount;
        }

        if (remarks) updateData.remarks = remarks;

        const penalty = await prisma.projectLDPenalty.update({
            where: { id },
            data: updateData,
        });

        return NextResponse.json(penalty);
    } catch (error: any) {
        console.error('Error updating LD/penalty:', error);
        return NextResponse.json({ error: 'Failed to update LD/penalty' }, { status: 500 });
    }
}

// DELETE /api/projects/ld-penalties - Delete
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }

        const existing = await prisma.projectLDPenalty.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json({ error: 'LD/penalty not found' }, { status: 404 });
        }

        if (existing.status !== 'PROPOSED') {
            return NextResponse.json(
                { error: 'Only PROPOSED LD/penalties can be deleted' },
                { status: 400 }
            );
        }

        await prisma.projectLDPenalty.delete({ where: { id } });
        return NextResponse.json({ message: 'LD/penalty deleted successfully' });
    } catch (error: any) {
        console.error('Error deleting LD/penalty:', error);
        return NextResponse.json({ error: 'Failed to delete LD/penalty' }, { status: 500 });
    }
}
