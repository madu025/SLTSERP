import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/projects/requisitions?projectId=xxx - List requisitions by project
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        if (!projectId) {
            return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
        }

        const requisitions = await prisma.projectRequisition.findMany({
            where: { projectId },
            include: {
                items: true,
                vendor: true,
                quotations: {
                    include: { items: true }
                },
                purchaseOrders: {
                    include: { items: true }
                }
            },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json(requisitions);
    } catch (error: any) {
        console.error('Error fetching requisitions:', error);
        return NextResponse.json({ error: 'Failed to fetch requisitions' }, { status: 500 });
    }
}

// POST /api/projects/requisitions - Create a new requisition with items
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            projectId,
            title,
            description,
            priority,
            type,
            deliveryLocation,
            requiredDate,
            requestedById,
            vendorId,
            items,
            remarks,
        } = body;

        // Validate required fields
        if (!projectId || !title || !requestedById || !items?.length) {
            return NextResponse.json(
                { error: 'projectId, title, requestedById, and items are required' },
                { status: 400 }
            );
        }

        // Verify project exists
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        // Auto-generate PR number
        const lastPR = await prisma.projectRequisition.findFirst({
            orderBy: { prNumber: 'desc' },
            select: { prNumber: true },
        });

        let nextPRNumber: string;
        if (lastPR && lastPR.prNumber) {
            const lastNum = parseInt(lastPR.prNumber.replace('PR-', ''), 10);
            const nextNum = isNaN(lastNum) ? 1 : lastNum + 1;
            nextPRNumber = 'PR-' + String(nextNum).padStart(5, '0');
        } else {
            nextPRNumber = 'PR-00001';
        }

        // Calculate total from items
        const estimatedTotal = items.reduce((sum: number, item: any) => {
            return sum + (item.estimatedPrice || 0) * (item.quantity || 0);
        }, 0);

        // Use transaction to create requisition + items
        const requisition = await prisma.$transaction(async (tx) => {
            const newReq = await tx.projectRequisition.create({
                data: {
                    prNumber: nextPRNumber,
                    projectId,
                    title,
                    description: description || null,
                    priority: priority || 'MEDIUM',
                    type: type || 'MATERIAL',
                    deliveryLocation: deliveryLocation || null,
                    requiredDate: requiredDate ? new Date(requiredDate) : null,
                    requestedById,
                    vendorId: vendorId || null,
                    estimatedTotal,
                    remarks: remarks || null,
                    items: {
                        create: items.map((item: any) => ({
                            boqItemId: item.boqItemId || null,
                            itemCode: item.itemCode,
                            description: item.description,
                            unit: item.unit || 'NOS',
                            quantity: item.quantity || 0,
                            estimatedPrice: item.estimatedPrice || 0,
                            totalEstimated: (item.estimatedPrice || 0) * (item.quantity || 0),
                            notes: item.notes || null,
                        })),
                    },
                },
                include: { items: true, vendor: true },
            });
            return newReq;
        });

        return NextResponse.json(requisition, { status: 201 });
    } catch (error: any) {
        console.error('Error creating requisition:', error);
        if (error.code === 'P2002') {
            return NextResponse.json({ error: 'Requisition number already exists' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Failed to create requisition' }, { status: 500 });
    }
}

// PATCH /api/projects/requisitions - Update requisition status
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, status, approvedById, rejectionReason } = body;

        if (!id || !status) {
            return NextResponse.json({ error: 'id and status are required' }, { status: 400 });
        }

        // Validate status transitions
        const validStatuses = ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];
        if (!validStatuses.includes(status)) {
            return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
        }

        const existing = await prisma.projectRequisition.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json({ error: 'Requisition not found' }, { status: 404 });
        }

        // Only allow status transitions from DRAFT or PENDING
        if (existing.status === 'APPROVED' || existing.status === 'REJECTED' || existing.status === 'CANCELLED') {
            return NextResponse.json(
                { error: `Cannot change status from ${existing.status}` },
                { status: 400 }
            );
        }

        const updateData: any = { status };
        if (status === 'APPROVED' && approvedById) {
            updateData.approvedById = approvedById;
            updateData.approvedAt = new Date();
        }
        if (status === 'REJECTED') {
            updateData.rejectionReason = rejectionReason || null;
        }

        const requisition = await prisma.projectRequisition.update({
            where: { id },
            data: updateData,
            include: { items: true, vendor: true },
        });

        return NextResponse.json(requisition);
    } catch (error: any) {
        console.error('Error updating requisition:', error);
        return NextResponse.json({ error: 'Failed to update requisition' }, { status: 500 });
    }
}

// DELETE /api/projects/requisitions - Delete a requisition (DRAFT only)
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }

        const existing = await prisma.projectRequisition.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json({ error: 'Requisition not found' }, { status: 404 });
        }

        if (existing.status !== 'DRAFT') {
            return NextResponse.json(
                { error: 'Only DRAFT requisitions can be deleted' },
                { status: 400 }
            );
        }

        await prisma.projectRequisition.delete({ where: { id } });
        return NextResponse.json({ message: 'Requisition deleted successfully' });
    } catch (error: any) {
        console.error('Error deleting requisition:', error);
        return NextResponse.json({ error: 'Failed to delete requisition' }, { status: 500 });
    }
}
