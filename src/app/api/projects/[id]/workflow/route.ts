import { NextResponse } from 'next/server';
import { ProjectWorkflowService } from '@/services/project-workflow.service';

// GET /api/projects/[id]/workflow - Get active workflow instance
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const workflowInstance = await ProjectWorkflowService.getWorkflow(id);

        if (!workflowInstance) {
            return NextResponse.json({ error: 'No active workflow found and could not auto-initialize' }, { status: 404 });
        }

        return NextResponse.json(workflowInstance);
    } catch (error: any) {
        console.error('Error fetching project workflow:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch project workflow' }, { status: 500 });
    }
}

// POST /api/projects/[id]/workflow - Initialize workflow manually
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { projectTypeId } = await request.json();

        if (!projectTypeId) {
            return NextResponse.json({ error: 'projectTypeId is required' }, { status: 400 });
        }

        const workflowInstance = await ProjectWorkflowService.initializeWorkflow(id, projectTypeId);
        return NextResponse.json({ success: true, workflowInstance });
    } catch (error: any) {
        console.error('Error initializing workflow:', error);
        const message = error.message;
        if (message === 'WORKFLOW_ALREADY_INITIALIZED') {
            return NextResponse.json({ error: 'Workflow already initialized for this project' }, { status: 400 });
        }
        return NextResponse.json({ error: message || 'Failed to initialize workflow' }, { status: 500 });
    }
}
