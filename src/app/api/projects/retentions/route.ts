import { NextRequest, NextResponse } from 'next/server';
import { ProjectRetentionService } from '@/services/project-retention.service';

// GET /api/projects/retentions?projectId=xxx - List retentions by project
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        if (!projectId) {
            return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
        }

        const retentions = await ProjectRetentionService.getRetentions(projectId);
        return NextResponse.json(retentions);
    } catch (error: unknown) {
        console.error('Error fetching retentions:', error);
        return NextResponse.json({ error: 'Failed to fetch retentions' }, { status: 500 });
    }
}

// POST /api/projects/retentions - Create a new retention entry
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { projectId, title, retentionAmount } = body;

        if (!projectId || !title || !retentionAmount) {
            return NextResponse.json(
                { error: 'projectId, title, and retentionAmount are required' },
                { status: 400 }
            );
        }

        const retention = await ProjectRetentionService.createRetention(body);
        return NextResponse.json(retention, { status: 201 });
    } catch (error: unknown) {
        console.error('Error creating retention:', error);
        return NextResponse.json({ error: 'Failed to create retention' }, { status: 500 });
    }
}

// PATCH /api/projects/retentions - Release retention or update
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, action, releaseAmount, releaseDate, approvedById, remarks } = body;

        if (!id || !action) {
            return NextResponse.json({ error: 'id and action are required' }, { status: 400 });
        }

        if (action === 'RELEASE') {
            if (!releaseAmount) {
                return NextResponse.json({ error: 'releaseAmount is required' }, { status: 400 });
            }

            const retention = await ProjectRetentionService.releaseRetention(id, releaseAmount, releaseDate, approvedById, remarks);
            return NextResponse.json(retention);
        }

        if (action === 'UPDATE') {
            const retention = await ProjectRetentionService.updateRetention(id, body);
            return NextResponse.json(retention);
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: unknown) {
        console.error('Error updating retention:', error);
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'RETENTION_NOT_FOUND') {
            return NextResponse.json({ error: 'Retention not found' }, { status: 404 });
        }
        if (errorMsg === 'RELEASE_AMOUNT_EXCEEDS_BALANCE') {
            return NextResponse.json({ error: 'Release amount cannot exceed balance' }, { status: 400 });
        }
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

        await ProjectRetentionService.deleteRetention(id);
        return NextResponse.json({ message: 'Retention deleted successfully' });
    } catch (error: unknown) {
        console.error('Error deleting retention:', error);
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'RETENTION_NOT_FOUND') {
            return NextResponse.json({ error: 'Retention not found' }, { status: 404 });
        }
        if (errorMsg === 'HAS_RELEASES') {
            return NextResponse.json({ error: 'Cannot delete retention with releases' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Failed to delete retention' }, { status: 500 });
    }
}
