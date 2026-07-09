import { NextResponse } from 'next/server';
import { GISReconciliationService } from '@/services/GISReconciliationService';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id') || 'system';
    const { id: projectId } = await params;

    const result = await GISReconciliationService.reconcile(projectId, userId);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error reconciling GIS route:', error);
    const message = error instanceof Error ? error.message : 'Failed to reconcile GIS route';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
