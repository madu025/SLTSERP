import { NextResponse } from 'next/server';
import { WorkflowEngine } from '@/services/WorkflowEngine';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { approvalId, status, userId, comments } = await request.json();

        if (!approvalId || !status || !userId) {
            return NextResponse.json({ error: 'approvalId, status, and userId are required' }, { status: 400 });
        }

        const updated = await WorkflowEngine.submitApproval(approvalId, status, userId, comments);
        return NextResponse.json({ success: true, approval: updated });
    } catch (error: any) {
        console.error('Error submitting approval:', error);
        return NextResponse.json({ error: error.message || 'Failed to submit approval' }, { status: 500 });
    }
}
