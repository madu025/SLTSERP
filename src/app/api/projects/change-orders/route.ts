import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/projects/change-orders?projectId=xxx - List change orders by project
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        if (!projectId) {
            return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
        }

        const changeOrders = await prisma.projectChangeOrder.findMany({
            where: { projectId },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json(changeOrders);
    } catch (error: any) {
        console.error('Error fetching change orders:', error);
        return NextResponse.json({ error: 'Failed to fetch change orders' }, { status: 500 });
    }
}

// POST /api/projects/change-orders - Create a new change order
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            projectId, title, description, type, priority, reason,
            referenceTable, referenceId, originalValue, newValue, costImpact,
            timeImpact, scopeImpact, riskAssessment, requestedById, notes,
        } = body;

        if (!projectId || !title) {
            return NextResponse.json(
                { error: 'projectId and title are required' },
                { status: 400 }
            );
        }

        // Verify project exists
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        // Auto-generate CO number: CO-XXXXX
        const lastCO = await prisma.projectChangeOrder.findFirst({
            where: { projectId },
            orderBy: { coNumber: 'desc' },
            select: { coNumber: true },
        });

        let nextSeq = 1;
        if (lastCO?.coNumber) {
            const num = parseInt(lastCO.coNumber.split('-')[1] || '0', 10);
            nextSeq = num + 1;
        }
        const coNumber = `CO-${String(nextSeq).padStart(5, '0')}`;

        const changeOrder = await prisma.projectChangeOrder.create({
            data: {
                coNumber,
                projectId,
                title,
                description: description || null,
                type: type || 'SCOPE',
                priority: priority || 'MEDIUM',
                reason: reason || null,
                referenceTable: referenceTable || null,
                referenceId: referenceId || null,
                originalValue: originalValue != null ? originalValue : null,
                newValue: newValue != null ? newValue : null,
                costImpact: costImpact ?? 0,
                timeImpact: timeImpact != null ? timeImpact : null,
                scopeImpact: scopeImpact || null,
                riskAssessment: riskAssessment || null,
                requestedById: requestedById || null,
                notes: notes || null,
                status: 'DRAFT',
            },
        });

        return NextResponse.json(changeOrder, { status: 201 });
    } catch (error: any) {
        console.error('Error creating change order:', error);
        return NextResponse.json({ error: 'Failed to create change order' }, { status: 500 });
    }
}

// PATCH /api/projects/change-orders - Update change order status or details
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, action, ...updateData } = body;

        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }

        // Fetch existing
        const existing = await prisma.projectChangeOrder.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json({ error: 'Change order not found' }, { status: 404 });
        }

        let data: any = {};

        if (action === 'SUBMIT') {
            if (existing.status !== 'DRAFT') {
                return NextResponse.json({ error: 'Only DRAFT can be submitted' }, { status: 400 });
            }
            data.status = 'PENDING_APPROVAL';
        } else if (action === 'APPROVE') {
            if (existing.status !== 'PENDING_APPROVAL') {
                return NextResponse.json({ error: 'Only PENDING_APPROVAL can be approved' }, { status: 400 });
            }
            data.status = 'APPROVED';
            data.approvedById = updateData.approvedById || null;
            data.approvedAt = new Date();
        } else if (action === 'REJECT') {
            if (existing.status !== 'PENDING_APPROVAL') {
                return NextResponse.json({ error: 'Only PENDING_APPROVAL can be rejected' }, { status: 400 });
            }
            data.status = 'REJECTED';
            data.rejectionReason = updateData.rejectionReason || null;
        } else if (action === 'IMPLEMENT') {
            if (existing.status !== 'APPROVED') {
                return NextResponse.json({ error: 'Only APPROVED can be implemented' }, { status: 400 });
            }
            data.status = 'IMPLEMENTED';
            data.implementedById = updateData.implementedById || null;
            data.implementedAt = new Date();
        } else if (action === 'CANCEL') {
            if (existing.status === 'IMPLEMENTED' || existing.status === 'CANCELLED') {
                return NextResponse.json({ error: 'Cannot cancel an implemented or already cancelled change order' }, { status: 400 });
            }
            data.status = 'CANCELLED';
        } else if (action === 'UPDATE') {
            // Update editable fields for DRAFT/PENDING_APPROVAL
            if (existing.status !== 'DRAFT' && existing.status !== 'PENDING_APPROVAL') {
                return NextResponse.json({ error: 'Can only update DRAFT or PENDING_APPROVAL change orders' }, { status: 400 });
            }
            const { title, description, type, priority, reason, referenceTable, referenceId,
                originalValue, newValue, costImpact, timeImpact, scopeImpact, riskAssessment, notes } = updateData;
            if (title !== undefined) data.title = title;
            if (description !== undefined) data.description = description;
            if (type !== undefined) data.type = type;
            if (priority !== undefined) data.priority = priority;
            if (reason !== undefined) data.reason = reason;
            if (referenceTable !== undefined) data.referenceTable = referenceTable;
            if (referenceId !== undefined) data.referenceId = referenceId;
            if (originalValue !== undefined) data.originalValue = originalValue;
            if (newValue !== undefined) data.newValue = newValue;
            if (costImpact !== undefined) data.costImpact = costImpact;
            if (timeImpact !== undefined) data.timeImpact = timeImpact;
            if (scopeImpact !== undefined) data.scopeImpact = scopeImpact;
            if (riskAssessment !== undefined) data.riskAssessment = riskAssessment;
            if (notes !== undefined) data.notes = notes;
        } else {
            return NextResponse.json({ error: 'Invalid action. Use SUBMIT, APPROVE, REJECT, IMPLEMENT, CANCEL, or UPDATE' }, { status: 400 });
        }

        const updated = await prisma.projectChangeOrder.update({
            where: { id },
            data,
        });

        return NextResponse.json(updated);
    } catch (error: any) {
        console.error('Error updating change order:', error);
        return NextResponse.json({ error: 'Failed to update change order' }, { status: 500 });
    }
}

// DELETE /api/projects/change-orders - Delete a change order (DRAFT only)
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }

        const existing = await prisma.projectChangeOrder.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json({ error: 'Change order not found' }, { status: 404 });
        }
        if (existing.status !== 'DRAFT') {
            return NextResponse.json({ error: 'Only DRAFT change orders can be deleted' }, { status: 400 });
        }

        await prisma.projectChangeOrder.delete({ where: { id } });
        return NextResponse.json({ message: 'Change order deleted' });
    } catch (error: any) {
        console.error('Error deleting change order:', error);
        return NextResponse.json({ error: 'Failed to delete change order' }, { status: 500 });
    }
}
