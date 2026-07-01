import { NextResponse } from 'next/server';
import { ProjectMilestoneService } from '@/services/project-milestone.service';

// GET list milestones for a project
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        if (!projectId) {
            return NextResponse.json(
                { error: 'projectId query parameter is required' },
                { status: 400 }
            );
        }

        const milestones = await ProjectMilestoneService.getMilestones(projectId);
        return NextResponse.json(milestones);
    } catch (error: unknown) {
        console.error('Error fetching milestones:', error);
        return NextResponse.json(
            { error: 'Failed to fetch milestones' },
            { status: 500 }
        );
    }
}

// POST create milestone
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { projectId, name, targetDate } = body;

        if (!projectId || !name || !targetDate) {
            return NextResponse.json(
                { error: 'Project ID, Name and Target Date are required' },
                { status: 400 }
            );
        }

        const milestone = await ProjectMilestoneService.createMilestone(body);
        return NextResponse.json(milestone);
    } catch (error: unknown) {
        console.error('Error creating milestone:', error);
        return NextResponse.json(
            { error: 'Failed to create milestone' },
            { status: 500 }
        );
    }
}

// PATCH update milestone
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { id, ...updateData } = body;

        if (!id) {
            return NextResponse.json(
                { error: 'Milestone ID required' },
                { status: 400 }
            );
        }

        const milestone = await ProjectMilestoneService.updateMilestone(id, updateData);
        return NextResponse.json(milestone);
    } catch (error: unknown) {
        console.error('Error updating milestone:', error);
        return NextResponse.json(
            { error: 'Failed to update milestone' },
            { status: 500 }
        );
    }
}

// DELETE milestone
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { error: 'Milestone ID required' },
                { status: 400 }
            );
        }

        await ProjectMilestoneService.deleteMilestone(id);
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error('Error deleting milestone:', error);
        return NextResponse.json(
            { error: 'Failed to delete milestone' },
            { status: 500 }
        );
    }
}
