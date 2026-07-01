import { NextRequest, NextResponse } from 'next/server';
import { ProjectLDPenaltyService } from '@/services/project-ld-penalty.service';

// GET /api/projects/ld-penalties?projectId=xxx - List LD/Penalties by project
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        if (!projectId) {
            return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
        }

        const penalties = await ProjectLDPenaltyService.getPenalties(projectId);
        return NextResponse.json(penalties);
    } catch (error: unknown) {
        console.error('Error fetching LD/penalties:', error);
        return NextResponse.json({ error: 'Failed to fetch LD/penalties' }, { status: 500 });
    }
}

// POST /api/projects/ld-penalties - Create a new LD/Penalty
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { projectId, title, amount } = body;

        if (!projectId || !title || !amount) {
            return NextResponse.json(
                { error: 'projectId, title, and amount are required' },
                { status: 400 }
            );
        }

        const penalty = await ProjectLDPenaltyService.createPenalty(body);
        return NextResponse.json(penalty, { status: 201 });
    } catch (error: unknown) {
        console.error('Error creating LD/penalty:', error);
        return NextResponse.json({ error: 'Failed to create LD/penalty' }, { status: 500 });
    }
}

// PATCH /api/projects/ld-penalties - Update LD/Penalty status
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, status, ...options } = body;

        if (!id || !status) {
            return NextResponse.json({ error: 'id and status are required' }, { status: 400 });
        }

        const penalty = await ProjectLDPenaltyService.updatePenalty(id, status, options);
        return NextResponse.json(penalty);
    } catch (error: unknown) {
        console.error('Error updating LD/penalty:', error);
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'LD_PENALTY_NOT_FOUND') {
            return NextResponse.json({ error: 'LD/penalty not found' }, { status: 404 });
        }
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

        await ProjectLDPenaltyService.deletePenalty(id);
        return NextResponse.json({ message: 'LD/penalty deleted successfully' });
    } catch (error: unknown) {
        console.error('Error deleting LD/penalty:', error);
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'LD_PENALTY_NOT_FOUND') {
            return NextResponse.json({ error: 'LD/penalty not found' }, { status: 404 });
        }
        if (errorMsg === 'PROPOSED_ONLY_DELETION') {
            return NextResponse.json(
                { error: 'Only PROPOSED LD/penalties can be deleted' },
                { status: 400 }
            );
        }
        return NextResponse.json({ error: 'Failed to delete LD/penalty' }, { status: 500 });
    }
}
