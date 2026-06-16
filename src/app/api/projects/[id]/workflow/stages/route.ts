import { NextResponse } from 'next/server';
import { WorkflowEngine } from '@/services/WorkflowEngine';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { stageId, status, userId } = await request.json();

        if (!stageId || !status || !userId) {
            return NextResponse.json({ error: 'stageId, status, and userId are required' }, { status: 400 });
        }

        await WorkflowEngine.transitionStage(stageId, status, userId);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error transitioning stage:', error);
        return NextResponse.json({ error: error.message || 'Failed to transition stage' }, { status: 500 });
    }
}
