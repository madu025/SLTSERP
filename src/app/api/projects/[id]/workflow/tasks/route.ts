import { NextResponse } from 'next/server';
import { WorkflowEngine } from '@/services/WorkflowEngine';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { action } = body;

        if (action === 'update_task') {
            const { taskId, status, progress } = body;
            if (!taskId || !status) {
                return NextResponse.json({ error: 'taskId and status are required' }, { status: 400 });
            }
            const updated = await WorkflowEngine.updateTaskStatus(taskId, status, progress);
            return NextResponse.json({ success: true, task: updated });
        }

        if (action === 'update_checklist') {
            const { checklistId, isCompleted, photoUrl } = body;
            if (!checklistId) {
                return NextResponse.json({ error: 'checklistId is required' }, { status: 400 });
            }
            const updated = await WorkflowEngine.updateChecklistItem(checklistId, isCompleted, photoUrl);
            return NextResponse.json({ success: true, checklist: updated });
        }

        return NextResponse.json({ error: 'Invalid action parameter' }, { status: 400 });
    } catch (error: any) {
        console.error('Error updating task/checklist details:', error);
        return NextResponse.json({ error: error.message || 'Failed to update details' }, { status: 500 });
    }
}
