import { NextRequest, NextResponse } from 'next/server';
import { ProjectRequisitionService } from '@/services/project-requisition.service';

// GET /api/projects/requisitions?projectId=xxx - List requisitions by project
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        if (!projectId) {
            return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
        }

        const requisitions = await ProjectRequisitionService.getRequisitions(projectId);
        return NextResponse.json(requisitions);
    } catch (error: unknown) {
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
            requestedById,
            items,
        } = body;

        // Validate required fields
        if (!projectId || !title || !requestedById || !items?.length) {
            return NextResponse.json(
                { error: 'projectId, title, requestedById, and items are required' },
                { status: 400 }
            );
        }

        const requisition = await ProjectRequisitionService.createRequisition(body);
        return NextResponse.json(requisition, { status: 201 });
    } catch (error: unknown) {
        console.error('Error creating requisition:', error);
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'PROJECT_NOT_FOUND') {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }
        const errorCode = (error as { code?: string }).code;
        if (errorCode === 'P2002') {
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

        const requisition = await ProjectRequisitionService.updateRequisitionStatus(id, status, approvedById, rejectionReason);
        return NextResponse.json(requisition);
    } catch (error: unknown) {
        console.error('Error updating requisition:', error);
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'INVALID_STATUS') {
            return NextResponse.json({ error: 'Invalid status transition' }, { status: 400 });
        }
        if (errorMsg === 'REQUISITION_NOT_FOUND') {
            return NextResponse.json({ error: 'Requisition not found' }, { status: 404 });
        }
        if (errorMsg === 'STATUS_LOCKED') {
            return NextResponse.json({ error: 'Cannot change status from current finalized state' }, { status: 400 });
        }
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

        await ProjectRequisitionService.deleteRequisition(id);
        return NextResponse.json({ message: 'Requisition deleted successfully' });
    } catch (error: unknown) {
        console.error('Error deleting requisition:', error);
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'REQUISITION_NOT_FOUND') {
            return NextResponse.json({ error: 'Requisition not found' }, { status: 404 });
        }
        if (errorMsg === 'DRAFT_ONLY_DELETION') {
            return NextResponse.json({ error: 'Only DRAFT requisitions can be deleted' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Failed to delete requisition' }, { status: 500 });
    }
}
